import express, { type Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import path from "path";
import fs from "fs";
import csv from "csv-parser";
import bcrypt from "bcrypt";
import xlsx from "xlsx";
import { storage, generatePreviousOutstandingReceiptNumber, generateBoliReceiptNumber } from "./storage";
import { ZodError } from "zod";
import { eq, desc, max, sql } from "drizzle-orm";
import { db, query } from "./db";
import {
  insertUserSchema,
  insertEntrySchema,
  insertDravyaEntrySchema,
  insertExpenseEntrySchema,
  insertAdvancePaymentSchema,
  insertPreviousOutstandingRecordSchema,
  insertCorpusSettingsSchema,
  recordPaymentSchema,
  PaymentStatus,
  PaymentStatusType,
  PaymentMode,
  TransactionType,
  entries,
  expenseEntries,
  advancePayments,
  previousOutstandingRecords,
  corpusSettings,
  transactionLogs,
  users
} from "@shared/schema";
import { fromZodError } from "zod-validation-error";
import session from "express-session";
import MemoryStore from "memorystore";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";



export async function registerRoutes(app: Express): Promise<Server> {

  // Serve uploaded files statically
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

  // Set up session store
  const MemoryStoreSession = MemoryStore(session);

  app.use(session({
    secret: process.env.SESSION_SECRET || "ledger-secret-key",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production", // Secure in production
      sameSite: process.env.NODE_ENV === "production" ? 'none' : 'lax', // None for cross-site
      maxAge: 24 * 60 * 60 * 1000
    },
    store: new MemoryStoreSession({
      checkPeriod: 86400000 // Prune expired entries every 24h
    })
  }));

  // Set up authentication
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(new LocalStrategy(async (username, password, done) => {
    try {
      console.log(`[AUTH DEBUG] Login attempt for username: "${username}"`);
      const user = await storage.getUserByUsername(username);
      console.log(`[AUTH DEBUG] User found:`, user ? `ID: ${user.id}, Username: "${user.username}", Role: ${user.role}` : 'null');
      console.log(`[AUTH DEBUG] Stored password hash length:`, user?.password?.length, 'starts with:', user?.password?.substring(0, 10));

      if (!user) {
        console.log(`[AUTH DEBUG] No user found for username: "${username}"`);
        return done(null, false, { message: "Incorrect username" });
      }

      // Use bcrypt to compare hashed password
      console.log(`[AUTH DEBUG] Comparing password for user: "${username}"`);
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        console.log(`[AUTH DEBUG] Password mismatch for user: "${username}"`);
        return done(null, false, { message: "Incorrect password" });
      }

      if (user.status !== "active") {
        console.log(`[AUTH DEBUG] User account inactive: "${username}", Status: ${user.status}`);
        return done(null, false, { message: "User account is inactive" });
      }
      console.log(`[AUTH DEBUG] Login successful for username: "${username}"`);
      return done(null, user);
    } catch (err) {
      console.error(`[AUTH DEBUG] Error during authentication:`, err);
      return done(err);
    }
  }));

  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (err) {
      done(err);
    }
  });

  // Auth middleware
  const isAuthenticated = (req: Request, res: Response, next: any) => {
    if (req.isAuthenticated()) {
      return next();
    }
    res.status(401).json({ message: "Unauthorized" });
  };

  const isAdmin = (req: Request, res: Response, next: any) => {
    if (req.isAuthenticated() && req.user && (req.user as any).role === "admin") {
      return next();
    }
    res.status(403).json({ message: "Forbidden: Admin access required" });
  };

  const isAdminOrOperator = (req: Request, res: Response, next: any) => {
    if (req.isAuthenticated() && req.user &&
      ((req.user as any).role === "admin" || (req.user as any).role === "operator")) {
      return next();
    }
    res.status(403).json({ message: "Forbidden: Admin or Operator access required" });
  };

  const isOperator = (req: Request, res: Response, next: any) => {
    if (req.isAuthenticated() && req.user && (req.user as any).role === "operator") {
      return next();
    }
    res.status(403).json({ message: "Forbidden: Operator access required" });
  };

  // Auth routes
  app.post("/api/auth/login", (req, res, next) => {
    passport.authenticate("local", (err: Error, user: any, info: any) => {
      if (err) return next(err);
      if (!user) return res.status(401).json({ message: info.message || "Authentication failed" });

      req.logIn(user, (err) => {
        if (err) return next(err);
        return res.json({
          id: user.id,
          username: user.username,
          name: user.name,
          email: user.email,
          role: user.role,
          status: user.status,
          mobile: user.mobile,
          address: user.address
        });
      });
    })(req, res, next);
  });

  app.get("/api/auth/user", (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = req.user as any;
    res.json({
      id: user.id,
      username: user.username,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      mobile: user.mobile,
      address: user.address
    });
  });

  app.post("/api/auth/logout", (req, res) => {
    req.logout(() => {
      res.json({ success: true });
    });
  });

  // Set up multer for file uploads
  const uploadsDir = path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const storage_multer = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
      // Create unique filename with timestamp
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
  });

  const upload = multer({
    storage: storage_multer,
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB limit
    },
    fileFilter: (req, file, cb) => {
      const allowedTypes = [
        'image/jpeg',
        'image/jpg',
        'image/png',
        'application/pdf',
        'text/csv',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      ];

      if (file.fieldname === 'receiptFile' || file.fieldname === 'paymentScreenshot' || file.fieldname === 'attachmentFile' || file.fieldname === 'paymentFile') {
        const imageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
        if (imageTypes.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new Error('Only JPG, JPEG, PNG and PDF files are allowed'));
        }
      } else if (file.fieldname === 'file') {
        // For bulk upload files
        const csvTypes = ['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
        if (csvTypes.includes(file.mimetype) || file.originalname.endsWith('.csv')) {
          cb(null, true);
        } else {
          cb(new Error('Only CSV and Excel files are allowed for bulk upload'));
        }
      } else {
        cb(new Error('Unexpected field'));
      }
    }
  });

  // Update current user's profile
  app.patch("/api/auth/profile", isAuthenticated, async (req, res) => {
    try {
      const currentUser = req.user as any;
      const userId = currentUser.id;

      // Only allow certain fields to be updated
      const allowedUpdates = ["name", "email", "mobile", "address"];
      const updates: any = {};

      Object.keys(req.body).forEach(key => {
        if (allowedUpdates.includes(key)) {
          updates[key] = req.body[key];
        }
      });

      const updatedUser = await storage.updateUser(userId, updates);

      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // Invalidate caches to ensure updated data is reflected everywhere
      (req as any).sessionStore.all((err: any, sessions: any) => {
        if (sessions) {
          Object.values(sessions).forEach((session: any) => {
            const wsClient = (req as any).app.get('wsClients')?.get(session.id);
            if (wsClient) {
              wsClient.send(JSON.stringify({
                type: 'CACHE_INVALIDATION',
                keys: [
                  '/api/users',
                  '/api/entries',
                  '/api/dashboard',
                  '/api/auth/user'
                ]
              }));
            }
          });
        }
      });

      res.json(updatedUser);
    } catch (error) {
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  // User management routes
  app.get("/api/users", isAuthenticated, async (req, res) => {
    try {
      const currentUser = req.user as any;

      // Only allow admin and operator to access users
      if (currentUser.role !== 'admin' && currentUser.role !== 'operator') {
        return res.status(403).json({ message: "Forbidden: Admin or Operator access required" });
      }

      const users = await storage.getUsers();

      // Convert id from string to number for all users so UserSelect receives numbers
      const usersWithNumericIds = users.map(user => ({
        ...user,
        id: typeof user.id === 'string' ? parseInt(user.id) : user.id
      }));

      // All users are visible to both admin and operator roles
      // Edit permissions are controlled separately in the PATCH endpoint
      res.json(usersWithNumericIds);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // Get specific user details with related data
  app.get("/api/users/:id", isAuthenticated, async (req, res) => {
    try {
      const currentUser = req.user as any;
      const userId = parseInt(req.params.id);

      // Allow users to view their own profile, or admin/operator to view others
      const canViewProfile =
        parseInt(currentUser.id) === userId || // User viewing their own profile (convert to int for comparison)
        currentUser.role === 'admin' ||
        currentUser.role === 'operator';

      if (!canViewProfile) {
        return res.status(403).json({ message: "Forbidden: Can only view your own profile" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Operators can view admin user profiles but cannot edit them (edit control is in PATCH endpoint)

      res.json(user);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch user details" });
    }
  });

  // Note: /api/entries route is defined elsewhere in the file, this just adds userId filtering

  // Note: advance-payments and dravya-entries routes may be defined elsewhere

  // Get user's advance balance
  app.get("/api/users/:id/advance-balance", isAuthenticated, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const balance = await storage.calculateRemainingAdvancePayment(userId);
      res.json(balance);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch advance balance" });
    }
  });

  // Bulk user upload endpoint
  app.post("/api/users/bulk-upload", isAdminOrOperator, upload.single('file'), async (req, res) => {
    try {
      const currentUser = req.user as any;

      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const filePath = req.file.path;
      let errors = 0;
      let created = 0;

      // Read CSV file
      const readCSV = () => {
        return new Promise<any[]>((resolve, reject) => {
          const results: any[] = [];
          fs.createReadStream(filePath)
            .pipe(csv())
            .on('data', (data) => results.push(data))
            .on('end', () => resolve(results))
            .on('error', reject);
        });
      };

      try {
        const csvData = await readCSV();

        for (const row of csvData) {
          try {
            // Validate required fields
            if (!row.username || !row.password || !row.name || !row.email) {
              errors++;
              continue;
            }

            // Role validation based on current user
            const validRoles = currentUser.role === 'admin'
              ? ['admin', 'operator', 'viewer']
              : ['operator', 'viewer'];

            if (!validRoles.includes(row.role)) {
              errors++;
              continue;
            }

            // Create user data
            const userData = {
              username: row.username.trim(),
              password: row.password.trim(),
              name: row.name.trim(),
              email: row.email.trim(),
              mobile: row.mobile ? row.mobile.trim() : "",
              address: row.address ? row.address.trim() : "",
              role: row.role.trim(),
              status: row.status ? row.status.trim() : "active"
            };

            // Validate with schema
            const validatedData = insertUserSchema.parse(userData);

            // Check if username already exists
            const existingUser = await storage.getUserByUsername(validatedData.username);
            if (existingUser) {
              errors++;
              continue;
            }

            // Hash the password before storing
            const hashedPassword = await bcrypt.hash(validatedData.password, 10);
            const userWithHashedPassword = {
              ...validatedData,
              password: hashedPassword
            };

            // Create user
            await storage.createUser(userWithHashedPassword);
            created++;

          } catch (error) {
            console.error("Error creating user from CSV:", error);
            errors++;
          }
        }

        // Clean up uploaded file
        fs.unlinkSync(filePath);

        res.json({
          message: "Bulk upload completed",
          created,
          errors,
          total: csvData.length
        });

      } catch (error) {
        // Clean up uploaded file in case of error
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
        throw error;
      }

    } catch (error) {
      console.error("Bulk upload error:", error);
      res.status(500).json({ message: "Failed to process bulk upload" });
    }
  });

  // Check for duplicate mobile number
  app.post("/api/users/check-mobile", isAuthenticated, async (req, res) => {
    try {
      const currentUser = req.user as any;

      // Only allow admin and operator to check mobile numbers
      if (currentUser.role !== 'admin' && currentUser.role !== 'operator') {
        return res.status(403).json({ message: "Forbidden: Admin or Operator access required" });
      }

      const { mobile } = req.body;

      if (!mobile) {
        return res.status(400).json({ message: "Mobile number is required" });
      }

      // Check if mobile number already exists
      const existingUser = await storage.getUserByMobile(mobile);

      if (existingUser) {
        return res.status(200).json({
          exists: true,
          user: {
            id: existingUser.id,
            name: existingUser.name,
            username: existingUser.username,
            mobile: existingUser.mobile
          }
        });
      } else {
        return res.status(200).json({ exists: false });
      }
    } catch (error) {
      console.error("Error checking mobile number:", error);
      res.status(500).json({ message: "Failed to check mobile number" });
    }
  });

  app.post("/api/users", isAuthenticated, async (req, res) => {
    try {
      const currentUser = req.user as any;

      // Only allow admin and operator to create users
      if (currentUser.role !== 'admin' && currentUser.role !== 'operator') {
        return res.status(403).json({ message: "Forbidden: Admin or Operator access required" });
      }

      const userData = insertUserSchema.parse(req.body);

      // Operators cannot create admin users
      if (currentUser.role === 'operator' && userData.role === 'admin') {
        return res.status(403).json({ message: "Forbidden: Operators cannot create admin users" });
      }

      // Check for duplicate mobile number before creating user
      if (userData.mobile) {
        const existingUser = await storage.getUserByMobile(userData.mobile);
        if (existingUser) {
          return res.status(400).json({
            message: `Mobile number already exists for user: ${existingUser.name} (${existingUser.username})`
          });
        }
      }

      // Hash the password before storing
      console.log('[USER CREATE DEBUG] Creating user:', userData.username);
      console.log('[USER CREATE DEBUG] Password received, length:', userData.password.length);
      const hashedPassword = await bcrypt.hash(userData.password, 10);
      console.log('[USER CREATE DEBUG] Password hash generated, length:', hashedPassword.length, 'starts with:', hashedPassword.substring(0, 10));

      // Test: Verify the hash works by comparing immediately
      const testCompare = await bcrypt.compare(userData.password, hashedPassword);
      console.log('[USER CREATE DEBUG] Self-test comparison result:', testCompare ? '✅ SUCCESS' : '❌ FAILED');

      const userWithHashedPassword = {
        ...userData,
        password: hashedPassword
      };

      const user = await storage.createUser(userWithHashedPassword);
      console.log('[USER CREATE DEBUG] User created with ID:', user.id, 'username:', user.username);
      console.log('[USER CREATE DEBUG] ⚠️ IMPORTANT: Use the EXACT password you entered to login!');
      res.status(201).json(user);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: fromZodError(error).message });
      }
      res.status(500).json({ message: "Failed to create user" });
    }
  });

  app.patch("/api/users/:id", isAuthenticated, async (req, res) => {
    try {
      const currentUser = req.user as any;
      const userId = parseInt(req.params.id);

      // Only allow admin and operator to update users
      if (currentUser.role !== 'admin' && currentUser.role !== 'operator') {
        return res.status(403).json({ message: "Forbidden: Admin or Operator access required" });
      }

      // Get the user being updated to check their role
      const existingUser = await storage.getUser(userId);
      if (!existingUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // Operators cannot edit admin users
      if (currentUser.role === 'operator' && existingUser.role === 'admin') {
        return res.status(403).json({ message: "Forbidden: Operators cannot edit admin users" });
      }

      // Operators cannot change user role to admin
      if (currentUser.role === 'operator' && req.body.role === 'admin') {
        return res.status(403).json({ message: "Forbidden: Operators cannot assign admin role" });
      }

      // Hash password if it's being updated
      let updateData = req.body;
      if (req.body.password) {
        const hashedPassword = await bcrypt.hash(req.body.password, 10);
        updateData = {
          ...req.body,
          password: hashedPassword
        };
      }

      const updatedUser = await storage.updateUser(userId, updateData);
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // Since we're updating a user, we need to clear all entry caches where this user is referenced
      // This ensures entries will show the updated user name
      (req as any).sessionStore.all((err: any, sessions: any) => {
        if (sessions) {
          Object.values(sessions).forEach((session: any) => {
            const wsClient = (req as any).app.get('wsClients')?.get(session.id);
            if (wsClient) {
              wsClient.send(JSON.stringify({
                type: 'CACHE_INVALIDATION',
                keys: [
                  '/api/users',
                  '/api/entries',
                  `/api/entries/${userId}`,
                  '/api/dashboard'
                ]
              }));
            }
          });
        }
      });

      res.json(updatedUser);
    } catch (error) {
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  // Entry management routes - only for boli entries
  app.get("/api/entries", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const { userId, includeDeleted } = req.query;
      let entries;

      // Only admins can view deleted entries
      const showDeleted = includeDeleted === 'true' && user.role === 'admin';

      if (userId) {
        // Specific user requested - only for admin/operator or current user
        const targetUserId = parseInt(userId.toString());
        if (user.role === "admin" || user.role === "operator" || user.id === targetUserId) {
          entries = await storage.getUserEntries(targetUserId, showDeleted);
        } else {
          return res.status(403).json({ message: "Access denied" });
        }
      } else {
        // No specific user - use role-based logic
        if (user.role === "admin" || user.role === "operator") {
          entries = await storage.getEntries(showDeleted);
        } else {
          entries = await storage.getUserEntries(user.id, showDeleted);
        }
      }

      res.json(entries);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch entries" });
    }
  });

  // Separate dravya entries routes - completely isolated
  app.get("/api/dravya-entries", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const { userId } = req.query;
      const { query } = await import("./db");

      let sql: string, values: any[];

      if (userId) {
        // Specific user requested - only for admin/operator or current user
        const targetUserId = parseInt(userId.toString());
        if (user.role === "admin" || user.role === "operator" || user.id === targetUserId) {
          sql = "SELECT * FROM dravya_entries WHERE user_id = $1 ORDER BY id DESC";
          values = [targetUserId];
        } else {
          return res.status(403).json({ message: "Access denied" });
        }
      } else {
        // No specific user - use role-based logic
        if (user.role === "admin" || user.role === "operator") {
          sql = "SELECT * FROM dravya_entries ORDER BY id DESC";
          values = [];
        } else {
          sql = "SELECT * FROM dravya_entries WHERE user_id = $1 ORDER BY id DESC";
          values = [user.id];
        }
      }

      const result = await query(sql, values);
      const dravyaEntries = result.rows.map(row => ({
        ...row,
        userId: row.user_id,
        userName: row.user_name,
        userMobile: row.user_mobile,
        userAddress: row.user_address,
        entryDate: row.entry_date,
        createdBy: row.created_by,
        updatedAt: row.updated_at
      }));

      res.json(dravyaEntries);
    } catch (error) {
      console.error("Error fetching dravya entries:", error);
      res.status(500).json({ message: "Failed to fetch dravya entries" });
    }
  });

  // Get deleted entries (admin only) - MUST come before /api/entries/:id
  app.get("/api/entries/deleted", isAdmin, async (req, res) => {
    try {
      const { query } = await import("./db");

      // Get all deleted entries
      const result = await query(`
        SELECT e.*, u.name as user_name, u.mobile as user_mobile, u.address as user_address
        FROM entries e
        LEFT JOIN users u ON e.user_id = u.id
        WHERE e.entry_status = 'deleted'
        ORDER BY e.id DESC
      `);

      res.json(result.rows);
    } catch (error) {
      console.error("Error fetching deleted entries:", error);
      res.status(500).json({ message: "Failed to fetch deleted entries" });
    }
  });

  // Restore deleted entry (admin only)
  app.put("/api/entries/:id/restore", isAdmin, async (req, res) => {
    try {
      const entryId = parseInt(req.params.id);
      const user = req.user as any;

      // Get the entry first to check if it exists and is deleted
      const entry = await storage.getEntry(entryId);
      if (!entry) {
        return res.status(404).json({ message: "Entry not found" });
      }

      if (entry.entryStatus !== 'deleted') {
        return res.status(400).json({ message: "Entry is not deleted" });
      }

      // Restore - set entry_status back to 'active' and restore payment statuses
      const { query } = await import("./db");

      // Restore payments (remove 'deleted' status, revert to original)
      const restoredPayments = entry.payments.map(payment => {
        const { status, ...rest } = payment;
        return rest; // Remove the 'deleted' status
      });

      // Update entry to restore it
      const updateSql = `
        UPDATE entries 
        SET entry_status = $1,
            payments = $2,
            updated_at = $3
        WHERE id = $4
        RETURNING *
      `;

      const updateValues = [
        'active',
        JSON.stringify(restoredPayments),
        new Date().toISOString(),
        entryId
      ];

      await query(updateSql, updateValues);

      // Log the restoration
      const logSql = `
        INSERT INTO transaction_logs (
          entry_id, user_id, username, description, 
          amount, transaction_type, details, date, timestamp
        ) VALUES (
          $1, $2, $3, $4, 
          $5, $6, $7, $8, $9
        )
      `;

      const logValues = [
        entryId,
        user.id,
        user.username,
        `Restored boli entry #${entryId}: ${entry.description}`,
        entry.totalAmount,
        'credit',
        JSON.stringify({
          entryId,
          description: entry.description,
          totalAmount: entry.totalAmount,
          userName: entry.userName
        }),
        new Date().toISOString().split('T')[0],
        new Date().toISOString()
      ];

      await query(logSql, logValues);

      res.status(200).json({ message: "Entry restored successfully" });
    } catch (error) {
      console.error("Error restoring entry:", error);
      res.status(500).json({ message: "Server error while restoring entry" });
    }
  });

  app.get("/api/entries/:id", isAuthenticated, async (req, res) => {
    try {
      const entryId = parseInt(req.params.id);
      const entry = await storage.getEntry(entryId);

      if (!entry) {
        return res.status(404).json({ message: "Entry not found" });
      }

      const user = req.user as any;
      if (user.role !== "admin" && user.role !== "operator" && entry.userId !== user.id) {
        return res.status(403).json({ message: "Access denied" });
      }

      res.json(entry);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch entry" });
    }
  });

  // Only operators can create entries
  // Separate endpoint for creating dravya entries
  app.post("/api/dravya-entries", isAdminOrOperator, async (req, res) => {
    try {
      console.log("Dravya entry creation data:", req.body);

      // Parse and validate the data using Zod
      const dravyaData = insertDravyaEntrySchema.parse(req.body);
      console.log("Parsed dravya entry data:", dravyaData);

      const currentUser = req.user as any;
      console.log("Current user:", currentUser.id, currentUser.username);

      const { query } = await import("./db");

      // Get the user data
      const user = await storage.getUser(dravyaData.userId);

      // Create the dravya entry
      const sql = `
        INSERT INTO dravya_entries (
          user_id, user_name, user_mobile, user_address,
          description, occasion, entry_date, created_by, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9
        ) RETURNING *
      `;

      const values = [
        dravyaData.userId,
        user?.name || dravyaData.userName || 'Unknown User',
        user?.mobile || '',
        user?.address || '',
        dravyaData.description || '',
        dravyaData.occasion || '',
        dravyaData.entryDate || new Date().toISOString().split('T')[0],
        currentUser ? currentUser.username : 'system',
        new Date().toISOString()
      ];

      console.log("Executing dravya SQL with values:", values);

      const result = await query(sql, values);
      console.log("Dravya entry creation result:", result.rows[0]);

      // Map the raw DB object to our format
      const rawEntry = result.rows[0];
      const dravyaEntry = {
        ...rawEntry,
        userId: rawEntry.user_id,
        userName: rawEntry.user_name,
        userMobile: rawEntry.user_mobile,
        userAddress: rawEntry.user_address,
        entryDate: rawEntry.entry_date,
        createdBy: rawEntry.created_by,
        updatedAt: rawEntry.updated_at
      };

      console.log("Dravya entry created successfully:", dravyaEntry);

      // Send mobile notification for dravya entry
      console.log(`[MOBILE NOTIFICATION] New dravya entry created for ${dravyaEntry.userName} (${dravyaEntry.userMobile})`);
      console.log(`Dravya Entry: ${dravyaEntry.description}`);

      res.status(201).json(dravyaEntry);
    } catch (error) {
      console.error("Error creating dravya entry:", error);
      if (error instanceof ZodError) {
        return res.status(400).json({ message: fromZodError(error).message });
      }
      res.status(500).json({ message: "Failed to create dravya entry" });
    }
  });

  // GET expense entries (only for operators) with optional date filtering
  app.get("/api/expense-entries", isAdminOrOperator, async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      const { query } = await import("./db");

      let sql = 'SELECT * FROM expense_entries WHERE 1=1';
      const params: any[] = [];

      // Add date range filtering if provided
      if (startDate) {
        sql += ` AND expense_date >= $${params.length + 1}`;
        params.push(startDate);
      }

      if (endDate) {
        sql += ` AND expense_date <= $${params.length + 1}`;
        params.push(endDate);
      }

      sql += ' ORDER BY expense_date DESC, id DESC';

      const result = await query(sql, params);
      res.json(result.rows);
    } catch (error) {
      console.error("Error fetching expense entries:", error);
      res.status(500).json({ message: "Failed to fetch expense entries" });
    }
  });

  // GET single expense entry by ID
  app.get("/api/expense-entries/:id", isAdminOrOperator, async (req, res) => {
    try {
      const entryId = parseInt(req.params.id);
      const { query } = await import("./db");

      const result = await query('SELECT * FROM expense_entries WHERE id = $1', [entryId]);

      if (result.rows.length === 0) {
        return res.status(404).json({ message: "Expense entry not found" });
      }

      res.json(result.rows[0]);
    } catch (error) {
      console.error("Error fetching expense entry:", error);
      res.status(500).json({ message: "Failed to fetch expense entry" });
    }
  });

  // POST new expense entry (only for operators) with file uploads
  app.post("/api/expense-entries", isAdminOrOperator, upload.fields([
    { name: 'receiptFile', maxCount: 1 },
    { name: 'paymentScreenshot', maxCount: 1 }
  ]), async (req, res) => {
    try {
      console.log("Expense entry creation data:", req.body);
      console.log("Uploaded files:", req.files);

      const files = req.files as { [fieldname: string]: Express.Multer.File[] };

      // Parse form data from multipart request
      const expenseData = {
        firmName: req.body.firmName || null,
        billNo: req.body.billNo || null,
        billDate: req.body.billDate || null,
        description: req.body.description,
        amount: parseInt(req.body.amount),
        quantity: req.body.quantity ? parseInt(req.body.quantity) : null,
        reason: req.body.reason || null,
        expenseDate: req.body.expenseDate,
        paymentMode: req.body.paymentMode,
        approvedBy: req.body.approvedBy,
        paidBy: req.body.paidBy,
        createdBy: req.body.createdBy
      };

      // Validate the parsed data
      const validatedData = insertExpenseEntrySchema.parse(expenseData);
      console.log("Parsed expense entry data:", validatedData);

      const currentUser = req.user as any;
      console.log("Current user:", currentUser.id, currentUser.username);

      // Handle file uploads
      let receiptUrl = null;
      let paymentScreenshotUrl = null;

      if (files.receiptFile && files.receiptFile[0]) {
        receiptUrl = `/uploads/${files.receiptFile[0].filename}`;
      }

      if (files.paymentScreenshot && files.paymentScreenshot[0]) {
        paymentScreenshotUrl = `/uploads/${files.paymentScreenshot[0].filename}`;
      }

      // Create expense entry with raw SQL
      const { query } = await import("./db");

      const sql = `
        INSERT INTO expense_entries (
          firm_name, bill_no, bill_date, description, amount, quantity, reason,
          expense_date, payment_mode, attachment_url, approved_by, paid_by,
          created_by, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9, $10, $11, $12,
          $13, $14
        ) RETURNING *
      `;

      // Combine receipt and payment screenshot URLs
      const attachmentUrls = [receiptUrl, paymentScreenshotUrl].filter(Boolean).join(';');

      const values = [
        validatedData.firmName,
        validatedData.billNo,
        validatedData.billDate,
        validatedData.description,
        validatedData.amount,
        validatedData.quantity,
        validatedData.reason,
        validatedData.expenseDate,
        validatedData.paymentMode,
        attachmentUrls || null,
        validatedData.approvedBy,
        validatedData.paidBy,
        currentUser ? currentUser.username : 'system',
        new Date().toISOString()
      ];

      console.log("Executing expense SQL with values:", values);

      const result = await query(sql, values);
      console.log("Expense entry creation result:", result.rows[0]);

      const expenseEntry = result.rows[0];

      console.log("Expense entry created successfully:", expenseEntry);

      // Send mobile notification for expense entry
      console.log(`[MOBILE NOTIFICATION] New expense entry created: ${expenseEntry.description}`);
      console.log(`Amount: ₹${(expenseEntry.amount / 100).toFixed(2)} | Approved by: ${expenseEntry.approved_by}`);

      res.status(201).json(expenseEntry);
    } catch (error) {
      console.error("Error creating expense entry:", error);
      if (error instanceof ZodError) {
        return res.status(400).json({ message: fromZodError(error).message });
      }
      res.status(500).json({ message: "Failed to create expense entry" });
    }
  });

  // PATCH expense entry (edit) - accessible by admin and operator
  app.patch("/api/expense-entries/:id", isAdminOrOperator, upload.fields([
    { name: 'receiptFile', maxCount: 1 },
    { name: 'paymentScreenshot', maxCount: 1 }
  ]), async (req, res) => {
    try {
      const expenseId = parseInt(req.params.id);
      console.log("Updating expense entry ID:", expenseId);
      console.log("Update data:", req.body);
      console.log("Uploaded files:", req.files);

      const { query } = await import("./db");

      // Check if expense entry exists
      const existingResult = await query('SELECT * FROM expense_entries WHERE id = $1', [expenseId]);
      if (existingResult.rows.length === 0) {
        return res.status(404).json({ message: "Expense entry not found" });
      }

      const existingEntry = existingResult.rows[0];
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };

      // Parse form data from multipart request
      const expenseData = {
        firmName: req.body.firmName || null,
        billNo: req.body.billNo || null,
        billDate: req.body.billDate || null,
        description: req.body.description,
        amount: parseInt(req.body.amount),
        quantity: req.body.quantity ? parseInt(req.body.quantity) : null,
        reason: req.body.reason || null,
        expenseDate: req.body.expenseDate,
        paymentMode: req.body.paymentMode,
        approvedBy: req.body.approvedBy,
        paidBy: req.body.paidBy,
        createdBy: req.body.createdBy
      };

      // Validate the parsed data
      const validatedData = insertExpenseEntrySchema.parse(expenseData);
      console.log("Validated expense entry data:", validatedData);

      const currentUser = req.user as any;

      // Handle file uploads
      let receiptUrl = null;
      let paymentScreenshotUrl = null;

      // Parse existing attachments
      const existingAttachments = existingEntry.attachment_url ? existingEntry.attachment_url.split(';').filter(Boolean) : [];
      const existingReceipt = existingAttachments.find((url: string) => url.includes('receiptFile')) || null;
      const existingPaymentScreenshot = existingAttachments.find((url: string) => url.includes('paymentScreenshot')) || null;

      // Use new files if uploaded, otherwise keep existing
      if (files.receiptFile && files.receiptFile[0]) {
        receiptUrl = `/uploads/${files.receiptFile[0].filename}`;
      } else {
        receiptUrl = existingReceipt;
      }

      if (files.paymentScreenshot && files.paymentScreenshot[0]) {
        paymentScreenshotUrl = `/uploads/${files.paymentScreenshot[0].filename}`;
      } else {
        paymentScreenshotUrl = existingPaymentScreenshot;
      }

      // Combine receipt and payment screenshot URLs
      const attachmentUrls = [receiptUrl, paymentScreenshotUrl].filter(Boolean).join(';');

      const sql = `
        UPDATE expense_entries SET
          firm_name = $1,
          bill_no = $2,
          bill_date = $3,
          description = $4,
          amount = $5,
          quantity = $6,
          reason = $7,
          expense_date = $8,
          payment_mode = $9,
          attachment_url = $10,
          approved_by = $11,
          paid_by = $12,
          updated_at = $13
        WHERE id = $14
        RETURNING *
      `;

      const values = [
        validatedData.firmName,
        validatedData.billNo,
        validatedData.billDate,
        validatedData.description,
        validatedData.amount,
        validatedData.quantity,
        validatedData.reason,
        validatedData.expenseDate,
        validatedData.paymentMode,
        attachmentUrls || null,
        validatedData.approvedBy,
        validatedData.paidBy,
        new Date().toISOString(),
        expenseId
      ];

      console.log("Executing expense update SQL with values:", values);

      const result = await query(sql, values);
      const updatedEntry = result.rows[0];

      console.log("Expense entry updated successfully:", updatedEntry);

      res.json(updatedEntry);
    } catch (error) {
      console.error("Error updating expense entry:", error);
      if (error instanceof ZodError) {
        return res.status(400).json({ message: fromZodError(error).message });
      }
      res.status(500).json({ message: "Failed to update expense entry" });
    }
  });

  // DELETE expense entry - accessible only by admin
  app.delete("/api/expense-entries/:id", isAdmin, async (req, res) => {
    try {
      const expenseId = parseInt(req.params.id);
      console.log("Deleting expense entry ID:", expenseId);

      const { query } = await import("./db");

      // Check if expense entry exists
      const existingResult = await query('SELECT * FROM expense_entries WHERE id = $1', [expenseId]);
      if (existingResult.rows.length === 0) {
        return res.status(404).json({ message: "Expense entry not found" });
      }

      // Delete the expense entry
      await query('DELETE FROM expense_entries WHERE id = $1', [expenseId]);

      console.log(`Expense entry ${expenseId} deleted successfully`);

      res.json({ message: "Expense entry deleted successfully" });
    } catch (error) {
      console.error("Error deleting expense entry:", error);
      res.status(500).json({ message: "Failed to delete expense entry" });
    }
  });

  // Function to calculate remaining advance payments for a user
  async function calculateRemainingAdvancePayment(userId: number): Promise<number> {
    const { query } = await import("./db");

    // Get total advance payments for the user
    const advanceResult = await query(
      'SELECT COALESCE(SUM(amount), 0) as total_advance FROM advance_payments WHERE user_id = $1',
      [userId]
    );

    // Get total used advance payments (payments made using advance)
    const usedResult = await query(
      'SELECT COALESCE(SUM(amount), 0) as total_used FROM advance_payment_usage WHERE user_id = $1',
      [userId]
    );

    const totalAdvance = parseInt(advanceResult.rows[0]?.total_advance || '0');
    const totalUsed = parseInt(usedResult.rows[0]?.total_used || '0');

    console.log(`[DEBUG] User ${userId} - Total Advance: ${totalAdvance}, Total Used: ${totalUsed}`);

    const remainingBalance = totalAdvance - totalUsed;

    console.log(`[DEBUG] User ${userId} - Calculated Balance: ${remainingBalance}`);

    // Return 0 if balance would be negative (user can't have negative advance balance)
    const finalBalance = Math.max(0, remainingBalance);
    console.log(`[DEBUG] User ${userId} - Final Balance: ${finalBalance}`);

    return finalBalance;
  }

  // Function to auto-process boli payment using advance payment
  async function autoProcessBoliPayment(entryId: number, userId: number, boliAmount: number, boliDate: string, createdBy: string): Promise<void> {
    const { query } = await import("./db");

    const remainingAdvance = await calculateRemainingAdvancePayment(userId);

    if (remainingAdvance > 0) {
      const paymentAmount = Math.min(remainingAdvance, boliAmount);

      // Record the advance payment usage
      await query(
        'INSERT INTO advance_payment_usage (user_id, entry_id, amount, date, created_by, created_at) VALUES ($1, $2, $3, $4, $5, $6)',
        [userId, entryId, paymentAmount, boliDate, createdBy, new Date().toISOString()]
      );

      // Create payment record
      const paymentRecord = {
        date: boliDate,
        amount: paymentAmount,
        mode: 'advance_payment' as any,
        receiptNo: `ADV${new Date().getFullYear()}${String(Date.now()).slice(-6)}`,
        updatedBy: createdBy
      };

      // Update the entry with the payment
      const entry = await storage.getEntry(entryId);
      if (entry) {
        const updatedPayments = [...entry.payments, paymentRecord];
        const newReceivedAmount = entry.receivedAmount + paymentAmount;
        const newPendingAmount = entry.totalAmount - newReceivedAmount;

        let newStatus: PaymentStatusType;
        if (newPendingAmount <= 0) {
          newStatus = PaymentStatus.FULL;
        } else if (newReceivedAmount > 0) {
          newStatus = PaymentStatus.PARTIAL;
        } else {
          newStatus = PaymentStatus.PENDING;
        }

        await query(
          `UPDATE entries SET 
           payments = $1, received_amount = $2, pending_amount = $3, status = $4, updated_at = $5
           WHERE id = $6`,
          [JSON.stringify(updatedPayments), newReceivedAmount, newPendingAmount, newStatus, new Date().toISOString(), entryId]
        );
      }
    }
  }

  // API endpoint to process advance payment for a boli entry
  app.post("/api/entries/:id/advance-payment", isAuthenticated, async (req, res) => {
    try {
      const entryId = parseInt(req.params.id);
      const { amount, date } = req.body;
      const user = req.user as any;
      const userId = user?.id;

      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      if (!amount || amount <= 0) {
        return res.status(400).json({ message: "Invalid payment amount" });
      }

      const { query } = await import("./db");

      // Get the boli entry to find the user
      const entryResult = await query('SELECT * FROM entries WHERE id = $1', [entryId]);
      if (entryResult.rows.length === 0) {
        return res.status(404).json({ message: "Boli entry not found" });
      }

      const entry = entryResult.rows[0];
      const entryUserId = entry.user_id;

      // Get user's advance payment balance
      const remainingBalance = await calculateRemainingAdvancePayment(entryUserId);

      if (remainingBalance < amount) {
        return res.status(400).json({ message: "Insufficient advance payment balance" });
      }

      // Record the advance payment usage
      await query(
        'INSERT INTO advance_payment_usage (user_id, entry_id, amount, date, created_by, created_at) VALUES ($1, $2, $3, $4, $5, $6)',
        [entryUserId, entryId, amount, date, user.username, new Date().toISOString()]
      );

      // Create payment record with advance payment mode using unified SPDJMSJ receipt number
      const receiptNo = await generateUnifiedReceiptNumber(date);

      const paymentData = {
        date,
        amount,
        mode: 'advance_payment',
        receiptNo,
        updatedBy: user.username
      };

      // Get current entry payments
      const currentEntry = await query('SELECT payments FROM entries WHERE id = $1', [entryId]);
      const currentPayments = currentEntry.rows[0]?.payments || [];

      // Add new payment
      const updatedPayments = [...currentPayments, paymentData];

      // Calculate new totals
      const totalReceived = updatedPayments.reduce((sum, p) => sum + p.amount, 0);
      const pendingAmount = entry.total_amount - totalReceived;
      const status = pendingAmount <= 0 ? 'full' : totalReceived > 0 ? 'partial' : 'pending';

      // Update the entry
      await query(
        'UPDATE entries SET payments = $1, received_amount = $2, pending_amount = $3, status = $4, updated_at = $5 WHERE id = $6',
        [JSON.stringify(updatedPayments), totalReceived, pendingAmount, status, new Date().toISOString(), entryId]
      );

      // Log the transaction
      await query(
        'INSERT INTO transaction_logs (entry_id, user_id, username, transaction_type, amount, description, date, details, timestamp) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
        [
          entryId,
          entryUserId,
          user.username,
          'advance_payment_applied',
          amount,
          `Applied ₹${amount} from advance payment balance`,
          date,
          JSON.stringify({
            receiptNo,
            previousStatus: entry.status,
            newStatus: status,
            remainingBalance: remainingBalance - amount
          }),
          new Date().toISOString()
        ]
      );

      res.json({
        success: true,
        payment: paymentData,
        entry: {
          ...entry,
          payments: updatedPayments,
          received_amount: totalReceived,
          pending_amount: pendingAmount,
          status
        }
      });

    } catch (error) {
      console.error("Error processing advance payment:", error);
      res.status(500).json({ message: "Failed to process advance payment" });
    }
  });

  // API endpoint to get remaining advance payment balance for a user
  app.get("/api/users/:id/advance-balance", isAuthenticated, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      console.log(`Calculating advance balance for user ${userId}`);
      const remainingBalance = await calculateRemainingAdvancePayment(userId);
      console.log(`Advance balance result for user ${userId}: ${remainingBalance}`);

      // Set cache headers to prevent caching
      res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });

      res.json(remainingBalance); // Return just the number, not an object
    } catch (error) {
      console.error("Error fetching user advance balance:", error);
      res.status(500).json({ message: "Failed to fetch advance balance" });
    }
  });

  // Advance payments routes (completely separate module)
  app.get("/api/advance-payments", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const { startDate, endDate, userId } = req.query;
      const { query } = await import("./db");

      let sql = `SELECT ap.*, u.address as user_address 
                 FROM advance_payments ap 
                 LEFT JOIN users u ON ap.user_id = u.id 
                 WHERE 1=1`;
      const params: any[] = [];

      // Add user filtering if specified
      if (userId) {
        const targetUserId = parseInt(userId.toString());
        if (user.role === "admin" || user.role === "operator" || user.id === targetUserId) {
          sql += ` AND ap.user_id = $${params.length + 1}`;
          params.push(targetUserId);
        } else {
          return res.status(403).json({ message: "Access denied" });
        }
      } else if (user.role !== "admin" && user.role !== "operator") {
        // Non-admin/operator users can only see their own advance payments
        sql += ` AND ap.user_id = $${params.length + 1}`;
        params.push(user.id);
      }

      // Add date range filtering if provided
      if (startDate) {
        sql += ` AND date >= $${params.length + 1}`;
        params.push(startDate);
      }

      if (endDate) {
        sql += ` AND date <= $${params.length + 1}`;
        params.push(endDate);
      }

      sql += ' ORDER BY date DESC, id DESC';

      const result = await query(sql, params);
      const advancePayments = result.rows.map(row => ({
        ...row,
        userId: row.user_id,
        userName: row.user_name,
        userMobile: row.user_mobile,
        userAddress: row.user_address,
        paymentMode: row.payment_mode,
        attachmentUrl: row.attachment_url,
        receiptNo: row.receipt_no,
        createdBy: row.created_by,
        createdAt: row.created_at
      }));

      res.json(advancePayments);
    } catch (error) {
      console.error("Error fetching advance payments:", error);
      res.status(500).json({ message: "Failed to fetch advance payments" });
    }
  });

  // Function to generate SPDJMSJ receipt number using boli pattern
  async function generateUnifiedReceiptNumber(paymentDate: string): Promise<string> {
    return await generateBoliReceiptNumber(paymentDate);
  }

  // Function to generate advance payment receipt number (SPDJMSJ format only)
  async function generateAdvancePaymentReceiptNumber(paymentDate: string): Promise<string> {
    return await generateBoliReceiptNumber(paymentDate);
  }

  // POST new advance payment with file upload
  app.post("/api/advance-payments", isAdminOrOperator, upload.single('paymentScreenshot'), async (req, res) => {
    try {
      console.log("Advance payment creation data:", req.body);
      console.log("Uploaded file:", req.file);

      // Parse form data from multipart request
      const advancePaymentData = {
        userId: parseInt(req.body.userId),
        userName: req.body.userName,
        userMobile: req.body.userMobile || '',
        date: req.body.date,
        amount: parseInt(req.body.amount), // Amount already in correct format
        paymentMode: req.body.paymentMode,
        createdBy: req.body.createdBy
      };

      // Validate the parsed data
      const validatedData = insertAdvancePaymentSchema.parse(advancePaymentData);
      console.log("Parsed advance payment data:", validatedData);

      const currentUser = req.user as any;
      console.log("Current user:", currentUser.id, currentUser.username);

      // Handle file upload for payment screenshot
      let attachmentUrl = null;
      if (req.file) {
        attachmentUrl = `/uploads/${req.file.filename}`;
      }

      // Generate receipt number for advance payment
      const receiptNo = await generateAdvancePaymentReceiptNumber(validatedData.date);

      // Create advance payment with raw SQL
      const { query } = await import("./db");

      const sql = `
        INSERT INTO advance_payments (
          user_id, user_name, user_mobile, date,
          amount, payment_mode, attachment_url, receipt_no, created_by, created_at
        ) VALUES (
          $1, $2, $3, $4,
          $5, $6, $7, $8, $9, $10
        ) RETURNING *
      `;

      const values = [
        validatedData.userId,
        validatedData.userName,
        validatedData.userMobile || '',
        validatedData.date,
        validatedData.amount,
        validatedData.paymentMode,
        attachmentUrl,
        receiptNo,
        currentUser ? currentUser.username : 'system',
        new Date().toISOString()
      ];

      console.log("Executing advance payment SQL with values:", values);

      const result = await query(sql, values);
      console.log("Advance payment creation result:", result.rows[0]);

      const advancePayment = result.rows[0];

      console.log("Advance payment created successfully:", advancePayment);

      res.status(201).json({
        ...advancePayment,
        userId: advancePayment.user_id,
        userName: advancePayment.user_name,
        userMobile: advancePayment.user_mobile,
        paymentMode: advancePayment.payment_mode,
        attachmentUrl: advancePayment.attachment_url,
        receiptNo: advancePayment.receipt_no,
        createdBy: advancePayment.created_by,
        createdAt: advancePayment.created_at
      });
    } catch (error) {
      console.error("Error creating advance payment:", error);
      if (error instanceof ZodError) {
        return res.status(400).json({ message: fromZodError(error).message });
      }
      res.status(500).json({ message: "Failed to create advance payment" });
    }
  });

  app.post("/api/entries", isAdminOrOperator, async (req, res) => {
    try {
      console.log("Entry creation data:", req.body);
      const entryData = insertEntrySchema.parse(req.body);
      console.log("Parsed entry data:", entryData);

      const currentUser = req.user as any;
      console.log("Current user:", currentUser.id, currentUser.username);

      // Validate that the boli date is not in the future
      const boliDate = new Date(entryData.auctionDate);
      const today = new Date();
      today.setHours(23, 59, 59, 999); // Set to end of today

      if (boliDate > today) {
        return res.status(400).json({
          message: "Boli date cannot be in the future. Please select today's date or earlier."
        });
      }

      // Create entry and pass the current user's ID (who is creating the entry)
      // Use direct SQL to create the entry with proper column names
      const { query } = await import("./db");

      // Map the fields correctly for auction entries
      const quantity = entryData.quantity || 1;
      const totalAmount = entryData.amount * quantity;

      // Get the user data
      const user = await storage.getUser(entryData.userId);

      // Create the entry with raw SQL to ensure column names match
      const sql = `
        INSERT INTO entries (
          user_id, user_name, user_mobile, user_address,
          description, amount, quantity, total_amount,
          occasion, bedi_number, auction_date, pending_amount, received_amount,
          status, payments, created_by
        ) VALUES (
          $1, $2, $3, $4,
          $5, $6, $7, $8,
          $9, $10, $11, $12, $13,
          $14, $15, $16
        ) RETURNING *
      `;

      const values = [
        entryData.userId,
        user?.name || entryData.userName || 'Unknown User',
        user?.mobile || '',
        user?.address || '',
        entryData.description || '',
        entryData.amount || 0,
        quantity,
        totalAmount,
        entryData.occasion || '',
        entryData.bediNumber || '1', // बेदी क्रमांक
        entryData.auctionDate || new Date().toISOString().split('T')[0],
        totalAmount,
        0,
        'pending',
        '[]',
        currentUser ? currentUser.username : 'system'
      ];

      console.log("Executing SQL with values:", values);

      const result = await query(sql, values);
      console.log("Entry creation result:", result.rows[0]);

      // Create a transaction log for this entry creation (CREDIT)
      const logSql = `
        INSERT INTO transaction_logs (
          entry_id, user_id, username, description, 
          amount, transaction_type, details, date, timestamp
        ) VALUES (
          $1, $2, $3, $4, 
          $5, $6, $7, $8, $9
        )
      `;

      const logValues = [
        result.rows[0].id,
        currentUser.id,
        currentUser.username,
        `Entry created for ${user?.name || entryData.userName || 'Unknown User'} by ${currentUser.username}`,
        totalAmount,
        'credit', // Explicitly setting transaction_type to 'credit'
        JSON.stringify({
          description: entryData.description,
          occasion: entryData.occasion,
          auctionDate: entryData.auctionDate
        }),
        new Date().toISOString().split('T')[0],
        new Date().toISOString()
      ];

      await query(logSql, logValues);
      console.log("Transaction log created for entry creation");

      // Map the raw DB object to our format
      const rawEntry = result.rows[0];
      const entry = {
        ...rawEntry,
        userId: rawEntry.user_id,
        userName: rawEntry.user_name,
        userMobile: rawEntry.user_mobile,
        userAddress: rawEntry.user_address,
        totalAmount: rawEntry.total_amount,
        pendingAmount: rawEntry.pending_amount,
        receivedAmount: rawEntry.received_amount,
        auctionDate: rawEntry.auction_date,
        updatedAt: rawEntry.updated_at,
        createdBy: rawEntry.created_by,
        entryType: rawEntry.entry_type,
        unitOfMeasurement: rawEntry.unit_of_measurement
      };
      console.log("Entry created successfully:", entry);

      // Removed auto-payment processing - advance payments should only be applied manually
      // Auto-payment was causing issues where entries were automatically paid from advance balance
      // Now entries are created as pending and operators must manually apply advance payments when needed

      // Get the user for whom the entry was created
      const entryUser = await storage.getUser(entry.userId);

      // If entryUser exists, send notification
      if (entryUser) {
        // Import is done inside the handler to avoid circular dependencies
        const { NotificationService } = await import("./notification");
        NotificationService.notifyEntryCreated(entryUser, entry);
      }

      res.status(201).json(entry);
    } catch (error) {
      console.error("Error creating entry:", error);

      if (error instanceof ZodError) {
        return res.status(400).json({ message: fromZodError(error).message });
      }
      res.status(500).json({ message: "Failed to create entry" });
    }
  });

  // Entry update endpoint (for operators and admins with role-based field restrictions)
  app.put("/api/entries/:id", isAdminOrOperator, async (req, res) => {
    try {
      const entryId = parseInt(req.params.id);
      const currentUser = req.user as any;

      console.log(`=== ENTRY UPDATE DEBUG for ID ${entryId} ===`);
      console.log(`User: ${currentUser.username} (${currentUser.role})`);
      console.log(`Request body:`, JSON.stringify(req.body, null, 2));

      // Get the current entry to compare changes
      const existingEntry = await storage.getEntry(entryId);
      if (!existingEntry) {
        console.log(`ERROR: Entry ${entryId} not found in database`);
        return res.status(404).json({ message: "Entry not found" });
      }

      console.log(`Existing entry:`, {
        id: existingEntry.id,
        userName: existingEntry.userName,
        description: existingEntry.description,
        totalAmount: existingEntry.totalAmount,
        quantity: existingEntry.quantity,
        occasion: existingEntry.occasion,
        auctionDate: existingEntry.auctionDate
      });

      // Parse and validate the request body
      const updateData = insertEntrySchema.omit({
        createdBy: true
      }).parse({
        ...req.body,
        totalAmount: req.body.totalAmount, // Keep as number for validation
        quantity: req.body.quantity
      });

      // Role-based field restrictions
      if (currentUser.role === 'operator') {
        // Operators cannot edit the totalAmount field
        if (updateData.totalAmount !== existingEntry.totalAmount) {
          return res.status(403).json({
            message: "Operators cannot modify the total amount. Only administrators can edit this field."
          });
        }

        // Operators cannot change the user selection
        if (updateData.userId !== existingEntry.userId) {
          return res.status(403).json({
            message: "Operators cannot change the user selection. Only administrators can edit this field."
          });
        }
      }

      // Validate that the boli date is not in the future
      const boliDate = new Date(updateData.auctionDate);
      const today = new Date();
      today.setHours(23, 59, 59, 999); // Set to end of today

      if (boliDate > today) {
        return res.status(400).json({
          message: "Boli date cannot be in the future. Please select today's date or earlier."
        });
      }

      // Use totalAmount directly in rupees (no conversion needed)
      const updatedEntryData = {
        ...updateData,
        totalAmount: updateData.totalAmount,
        updatedAt: new Date().toISOString(),
      };

      // Update the entry
      console.log(`Calling storage.updateEntry with:`, updatedEntryData);
      const updatedEntry = await storage.updateEntry(entryId, updatedEntryData, currentUser.id);

      if (!updatedEntry) {
        console.log(`ERROR: storage.updateEntry returned null/undefined for entry ${entryId}`);
        return res.status(500).json({ message: "Failed to update entry" });
      }

      console.log(`Update successful! Updated entry:`, {
        id: updatedEntry.id,
        userName: updatedEntry.userName,
        description: updatedEntry.description,
        totalAmount: updatedEntry.totalAmount,
        quantity: updatedEntry.quantity,
        occasion: updatedEntry.occasion,
        auctionDate: updatedEntry.auctionDate
      });

      // Log the transaction
      const logSql = `
        INSERT INTO transaction_logs (
          entry_id, user_id, username, description, 
          amount, transaction_type, details, date, timestamp
        ) VALUES (
          $1, $2, $3, $4, 
          $5, $6, $7, $8, $9
        )
      `;

      const changes = {
        before: {
          description: existingEntry.description,
          totalAmount: existingEntry.totalAmount,
          quantity: existingEntry.quantity,
          occasion: existingEntry.occasion,
          auctionDate: existingEntry.auctionDate
        },
        after: {
          description: updateData.description,
          totalAmount: updateData.totalAmount,
          quantity: updateData.quantity,
          occasion: updateData.occasion,
          auctionDate: updateData.auctionDate
        },
        updatedBy: currentUser.username
      };

      const logValues = [
        entryId,
        currentUser.id,
        currentUser.username,
        `Entry updated by ${currentUser.username} (${currentUser.role})`,
        updateData.totalAmount,
        'update_entry',
        JSON.stringify(changes),
        new Date().toISOString().split('T')[0],
        new Date().toISOString()
      ];

      await query(logSql, logValues);
      console.log("Transaction log created for entry update");

      // Let's verify the data was actually saved by fetching it again
      const verifyEntry = await storage.getEntry(entryId);
      console.log(`VERIFICATION: Re-fetched entry after update:`, {
        id: verifyEntry?.id,
        userName: verifyEntry?.userName,
        description: verifyEntry?.description,
        totalAmount: verifyEntry?.totalAmount,
        quantity: verifyEntry?.quantity,
        occasion: verifyEntry?.occasion,
        auctionDate: verifyEntry?.auctionDate,
        updatedAt: verifyEntry?.updatedAt
      });

      console.log(`=== END ENTRY UPDATE DEBUG for ID ${entryId} ===`);
      res.json(updatedEntry);
    } catch (error) {
      console.error("Error updating entry:", error);

      if (error instanceof ZodError) {
        return res.status(400).json({ message: fromZodError(error).message });
      }
      res.status(500).json({ message: "Failed to update entry" });
    }
  });

  // Entry deletion endpoint (only for admins)
  // Soft delete boli entry (admin only)
  app.delete("/api/entries/:id", isAdmin, async (req, res) => {
    try {
      const entryId = parseInt(req.params.id);
      const user = req.user as any;

      // Get the entry first to check if it exists
      const entry = await storage.getEntry(entryId);
      if (!entry) {
        return res.status(404).json({ message: "Entry not found" });
      }

      // Check if already deleted
      if (entry.entryStatus === 'deleted') {
        return res.status(400).json({ message: "Entry is already deleted" });
      }

      // Soft delete - set entry_status to 'deleted' and mark all payments as deleted
      const { query } = await import("./db");

      // Mark all payments in the entry as deleted
      const updatedPayments = entry.payments.map(payment => ({
        ...payment,
        status: 'deleted' as const
      }));

      // Update entry with soft delete
      const updateSql = `
        UPDATE entries 
        SET entry_status = $1,
            payments = $2,
            updated_at = $3
        WHERE id = $4
        RETURNING *
      `;

      const updateValues = [
        'deleted',
        JSON.stringify(updatedPayments),
        new Date().toISOString(),
        entryId
      ];

      const updateResult = await query(updateSql, updateValues);

      // Log the soft delete
      const logSql = `
        INSERT INTO transaction_logs (
          entry_id, user_id, username, description, 
          amount, transaction_type, details, date, timestamp
        ) VALUES (
          $1, $2, $3, $4, 
          $5, $6, $7, $8, $9
        )
      `;

      const logValues = [
        entryId,
        user.id,
        user.username,
        `Soft deleted boli entry #${entryId}: ${entry.description}`,
        entry.totalAmount,
        'credit',
        JSON.stringify({
          entryId,
          description: entry.description,
          totalAmount: entry.totalAmount,
          receivedAmount: entry.receivedAmount,
          pendingAmount: entry.pendingAmount,
          userName: entry.userName
        }),
        new Date().toISOString().split('T')[0],
        new Date().toISOString()
      ];

      await query(logSql, logValues);

      res.status(200).json({ message: "Entry deleted successfully" });
    } catch (error) {
      console.error("Error deleting entry:", error);
      res.status(500).json({ message: "Server error while deleting entry" });
    }
  });

  // Transaction logs routes
  app.get("/api/transaction-logs", isAdmin, async (req, res) => {
    try {
      const logs = await storage.getTransactionLogs();
      res.json(logs);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch transaction logs" });
    }
  });

  app.get("/api/entries/:id/transaction-logs", isAdmin, async (req, res) => {
    try {
      const entryId = parseInt(req.params.id);
      const logs = await storage.getEntryTransactionLogs(entryId);
      res.json(logs);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch entry transaction logs" });
    }
  });

  // Payment management routes
  // Payment update functionality has been disabled
  app.put("/api/entries/:id/payments/:index", isAdmin, async (req, res) => {
    return res.status(403).json({ message: "Payment update functionality has been disabled" });
  });

  // Endpoint to delete a payment
  app.delete("/api/entries/:id/payments/:index", isAdmin, async (req, res) => {
    try {
      const entryId = parseInt(req.params.id);
      const paymentIndex = parseInt(req.params.index);
      const user = req.user as any;

      // Get the entry first to check if it exists
      const entryToUpdate = await storage.getEntry(entryId);
      if (!entryToUpdate) {
        return res.status(404).json({ message: "Entry not found" });
      }

      // Check if payment exists
      if (!entryToUpdate.payments || paymentIndex >= entryToUpdate.payments.length) {
        return res.status(404).json({ message: "Payment record not found" });
      }

      // Store the payment to be deleted for logging
      const deletedPayment = entryToUpdate.payments[paymentIndex];

      // Remove the payment from the array
      const updatedPayments = [...entryToUpdate.payments];
      updatedPayments.splice(paymentIndex, 1);

      // Calculate new received and pending amounts
      const newReceivedAmount = updatedPayments.reduce((sum, p) => sum + p.amount, 0);
      const newPendingAmount = entryToUpdate.totalAmount - newReceivedAmount;

      // Determine new payment status
      let newStatus = entryToUpdate.status;
      if (newReceivedAmount === 0) {
        newStatus = PaymentStatus.PENDING;
      } else if (newReceivedAmount < entryToUpdate.totalAmount) {
        newStatus = PaymentStatus.PARTIAL;
      } else {
        newStatus = PaymentStatus.FULL;
      }

      // Update the entry with SQL to ensure proper column names
      const { query } = await import("./db");
      const updateSql = `
        UPDATE entries 
        SET payments = $1, 
            received_amount = $2, 
            pending_amount = $3,
            status = $4
        WHERE id = $5
        RETURNING *
      `;

      const updateValues = [
        JSON.stringify(updatedPayments),
        newReceivedAmount,
        newPendingAmount,
        newStatus,
        entryId
      ];

      const updateResult = await query(updateSql, updateValues);
      const updatedEntry = updateResult.rows[0];

      // Log the deletion with CREDIT transaction type (since we're adding back to the account)
      const logSql = `
        INSERT INTO transaction_logs (
          entry_id, user_id, username, description, 
          amount, transaction_type, details, date, timestamp
        ) VALUES (
          $1, $2, $3, $4, 
          $5, $6, $7, $8, $9
        )
      `;

      const logValues = [
        entryId,
        user.id,
        user.username,
        `Deleted payment record of ₹${deletedPayment.amount} from entry #${entryId}`,
        deletedPayment.amount,
        'credit', // Explicitly setting transaction_type to 'credit'
        JSON.stringify({
          date: deletedPayment.date,
          mode: deletedPayment.mode,
          amount: deletedPayment.amount,
          fileUrl: deletedPayment.fileUrl,
          receiptNo: deletedPayment.receiptNo
        }),
        new Date().toISOString().split('T')[0],
        new Date().toISOString()
      ];

      await query(logSql, logValues);

      // If status has changed, log that too
      if (entryToUpdate.status !== newStatus) {
        const statusLogSql = `
          INSERT INTO transaction_logs (
            entry_id, user_id, username, description, 
            amount, transaction_type, details, date, timestamp
          ) VALUES (
            $1, $2, $3, $4, 
            $5, $6, $7, $8, $9
          )
        `;

        const statusLogValues = [
          entryId,
          user.id,
          user.username,
          `Payment status changed from ${entryToUpdate.status} to ${newStatus} after deleting payment`,
          0,
          'update_payment', // Explicitly setting transaction_type
          JSON.stringify({
            oldStatus: entryToUpdate.status,
            newStatus,
            deletedPayment
          }),
          new Date().toISOString().split('T')[0],
          new Date().toISOString()
        ];

        await query(statusLogSql, statusLogValues);
      }

      // Map the raw DB object to our format
      const mappedEntry = {
        ...updatedEntry,
        userId: updatedEntry.user_id,
        userName: updatedEntry.user_name,
        userMobile: updatedEntry.user_mobile,
        userAddress: updatedEntry.user_address,
        totalAmount: updatedEntry.total_amount,
        pendingAmount: updatedEntry.pending_amount,
        receivedAmount: updatedEntry.received_amount,
        auctionDate: updatedEntry.auction_date,
        updatedAt: updatedEntry.updated_at,
        createdBy: updatedEntry.created_by
      };

      res.json(mappedEntry);
    } catch (error) {
      console.error("Error deleting payment:", error);
      res.status(500).json({ message: "Failed to delete payment record" });
    }
  });

  // Create a dedicated upload middleware for payment attachments
  const paymentUpload = multer({
    storage: storage_multer,
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB limit
    },
    fileFilter: (req, file, cb) => {
      const imageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
      if (imageTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Only JPG, JPEG, PNG and PDF files are allowed'));
      }
    }
  });

  // PATCH route for editing payment - role-based restrictions
  app.patch("/api/entries/:id/payments/:index", isAdminOrOperator, paymentUpload.single('file'), async (req, res) => {
    try {
      const entryId = parseInt(req.params.id);
      const paymentIndex = parseInt(req.params.index);
      const user = req.user as any;
      const isAdmin = user.role === 'admin';

      // Get the entry first to check if it exists
      const entryToUpdate = await storage.getEntry(entryId);
      if (!entryToUpdate) {
        return res.status(404).json({ message: "Entry not found" });
      }

      // Check if payment exists
      if (!entryToUpdate.payments || paymentIndex >= entryToUpdate.payments.length) {
        return res.status(404).json({ message: "Payment record not found" });
      }

      // Get the existing payment
      const existingPayment = entryToUpdate.payments[paymentIndex];

      // Build updated payment object with role-based field whitelisting
      const updatedPayment = {
        ...existingPayment,
        updatedBy: user.username,
      };

      // Role-based field restrictions
      if (isAdmin) {
        // Admin can update all fields
        if (req.body.date) {
          updatedPayment.date = req.body.date;
        }
        if (req.body.amount) {
          updatedPayment.amount = parseInt(req.body.amount);
        }
        if (req.body.mode) {
          updatedPayment.mode = req.body.mode;
        }
        if (req.file) {
          updatedPayment.fileUrl = `/uploads/${req.file.filename}`;
        }
      } else {
        // Operators can ONLY edit mode - explicitly whitelist this field
        if (req.body.mode) {
          // Server-side validation: If changing from cash to non-cash, file is REQUIRED
          if (existingPayment.mode === PaymentMode.CASH &&
            req.body.mode !== PaymentMode.CASH &&
            !req.file) {
            return res.status(400).json({
              message: "Payment screenshot is required when changing from cash to UPI/other modes."
            });
          }

          updatedPayment.mode = req.body.mode;

          // Update fileUrl if screenshot provided
          if (req.file) {
            updatedPayment.fileUrl = `/uploads/${req.file.filename}`;
          }
        }

        // Explicitly reject any attempt to modify date or amount by operators
        if (req.body.date || req.body.amount) {
          return res.status(403).json({
            message: "Operators can only edit payment mode. Date and amount changes require admin access."
          });
        }
      }

      // Update payments array
      const updatedPayments = [...entryToUpdate.payments];
      updatedPayments[paymentIndex] = updatedPayment;

      // Recalculate received and pending amounts
      const newReceivedAmount = updatedPayments.reduce((sum, p) => sum + p.amount, 0);
      const newPendingAmount = entryToUpdate.totalAmount - newReceivedAmount;

      // Determine new payment status
      let newStatus = entryToUpdate.status;
      if (newReceivedAmount === 0) {
        newStatus = PaymentStatus.PENDING;
      } else if (newReceivedAmount < entryToUpdate.totalAmount) {
        newStatus = PaymentStatus.PARTIAL;
      } else {
        newStatus = PaymentStatus.FULL;
      }

      // Update the entry with SQL
      const { query } = await import("./db");
      const updateSql = `
        UPDATE entries 
        SET payments = $1, 
            received_amount = $2, 
            pending_amount = $3,
            status = $4,
            updated_at = $5
        WHERE id = $6
        RETURNING *
      `;

      const updateValues = [
        JSON.stringify(updatedPayments),
        newReceivedAmount,
        newPendingAmount,
        newStatus,
        new Date().toISOString(),
        entryId
      ];

      const updateResult = await query(updateSql, updateValues);
      const updatedEntry = updateResult.rows[0];

      // Log the payment edit
      const changesSummary = [];
      if (existingPayment.date !== updatedPayment.date) {
        changesSummary.push(`Date: ${existingPayment.date} → ${updatedPayment.date}`);
      }
      if (existingPayment.amount !== updatedPayment.amount) {
        changesSummary.push(`Amount: ₹${existingPayment.amount} → ₹${updatedPayment.amount}`);
      }
      if (existingPayment.mode !== updatedPayment.mode) {
        changesSummary.push(`Mode: ${existingPayment.mode} → ${updatedPayment.mode}`);
      }
      if (req.file) {
        changesSummary.push(`Screenshot updated`);
      }

      const logSql = `
        INSERT INTO transaction_logs (
          entry_id, user_id, username, description, 
          amount, transaction_type, details, date, timestamp
        ) VALUES (
          $1, $2, $3, $4, 
          $5, $6, $7, $8, $9
        )
      `;

      const logValues = [
        entryId,
        user.id,
        user.username,
        `Edited payment record for entry #${entryId}: ${changesSummary.join(', ')}`,
        updatedPayment.amount,
        'update_payment',
        JSON.stringify({
          paymentIndex,
          before: existingPayment,
          after: updatedPayment,
          changes: changesSummary
        }),
        new Date().toISOString().split('T')[0],
        new Date().toISOString()
      ];

      await query(logSql, logValues);

      // Map the raw DB object to our format
      const mappedEntry = {
        ...updatedEntry,
        userId: updatedEntry.user_id,
        userName: updatedEntry.user_name,
        userMobile: updatedEntry.user_mobile,
        userAddress: updatedEntry.user_address,
        totalAmount: updatedEntry.total_amount,
        pendingAmount: updatedEntry.pending_amount,
        receivedAmount: updatedEntry.received_amount,
        auctionDate: updatedEntry.auction_date,
        updatedAt: updatedEntry.updated_at,
        createdBy: updatedEntry.created_by
      };

      res.json(mappedEntry);
    } catch (error) {
      console.error("Error editing payment:", error);
      res.status(500).json({ message: "Failed to edit payment record" });
    }
  });

  // Endpoint to update payment attachment (Admin only)
  app.post("/api/payments/update-attachment", isAdmin, paymentUpload.single('file'), async (req, res) => {
    try {
      const entryId = parseInt(req.body.entryId);
      const paymentIndex = parseInt(req.body.paymentIndex);
      const user = req.user as any;

      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      // Get the entry to validate
      const entry = await storage.getEntry(entryId);
      if (!entry) {
        return res.status(404).json({ message: "Entry not found" });
      }

      // Check if payment exists
      if (!entry.payments || paymentIndex >= entry.payments.length || paymentIndex < 0) {
        return res.status(404).json({ message: "Payment record not found" });
      }

      // Store the old file URL for logging
      const oldFileUrl = entry.payments[paymentIndex].fileUrl;

      // Update the payment with new file URL
      const updatedPayments = [...entry.payments];
      updatedPayments[paymentIndex] = {
        ...updatedPayments[paymentIndex],
        fileUrl: `/uploads/${req.file.filename}`,
        updatedBy: user.username
      };

      // Update the entry with new payments array using SQL
      const { query } = await import("./db");
      const updateSql = `
        UPDATE entries 
        SET payments = $1, 
            updated_at = $2
        WHERE id = $3
        RETURNING *
      `;

      const updateValues = [
        JSON.stringify(updatedPayments),
        new Date().toISOString(),
        entryId
      ];

      const updateResult = await query(updateSql, updateValues);
      const updatedEntry = updateResult.rows[0];

      // Log the attachment update
      const logSql = `
        INSERT INTO transaction_logs (
          entry_id, user_id, username, description, 
          amount, transaction_type, details, date, timestamp
        ) VALUES (
          $1, $2, $3, $4, 
          $5, $6, $7, $8, $9
        )
      `;

      const logValues = [
        entryId,
        user.id,
        user.username,
        `Updated payment attachment for entry #${entryId}, payment #${paymentIndex + 1}`,
        updatedPayments[paymentIndex].amount,
        'update_payment',
        JSON.stringify({
          paymentIndex,
          oldFileUrl,
          newFileUrl: `/uploads/${req.file.filename}`,
          updatedBy: user.username
        }),
        new Date().toISOString().split('T')[0],
        new Date().toISOString()
      ];

      await query(logSql, logValues);

      // Delete old file if it exists and is different
      if (oldFileUrl && oldFileUrl !== `/uploads/${req.file.filename}`) {
        try {
          const oldFilePath = path.join(process.cwd(), oldFileUrl);
          if (fs.existsSync(oldFilePath)) {
            fs.unlinkSync(oldFilePath);
          }
        } catch (fileError) {
          console.log("Note: Could not delete old file:", oldFileUrl);
        }
      }

      // Map the raw DB object to our format
      const mappedEntry = {
        ...updatedEntry,
        userId: updatedEntry.user_id,
        userName: updatedEntry.user_name,
        userMobile: updatedEntry.user_mobile,
        userAddress: updatedEntry.user_address,
        totalAmount: updatedEntry.total_amount,
        pendingAmount: updatedEntry.pending_amount,
        receivedAmount: updatedEntry.received_amount,
        auctionDate: updatedEntry.auction_date,
        updatedAt: updatedEntry.updated_at,
        createdBy: updatedEntry.created_by
      };

      res.json({
        message: "Payment attachment updated successfully",
        entry: mappedEntry
      });
    } catch (error) {
      console.error("Error updating payment attachment:", error);
      res.status(500).json({ message: "Failed to update payment attachment" });
    }
  });

  // Endpoint to record a payment
  app.post("/api/entries/:id/payments", isAdminOrOperator, async (req, res) => {
    try {
      const entryId = parseInt(req.params.id);
      const paymentData = recordPaymentSchema.omit({ entryId: true }).parse(req.body);
      const user = req.user as any;

      const entry = await storage.getEntry(entryId);
      if (!entry) {
        return res.status(404).json({ message: "Entry not found" });
      }

      // Validation 1: Do not allow payments if already fully paid
      if (entry.status === PaymentStatus.FULL) {
        return res.status(400).json({ message: "Entry is already fully paid" });
      }

      // Validation 2: Do not allow payments if pending amount is 0
      if (entry.pendingAmount === 0) {
        return res.status(400).json({ message: "Cannot add payment: Pending amount is ₹0" });
      }

      // Validation 3: Payment amount cannot exceed the total boli amount
      if (paymentData.amount > entry.totalAmount) {
        return res.status(400).json({
          message: `Payment amount (₹${paymentData.amount.toLocaleString()}) cannot exceed total boli amount (₹${entry.totalAmount.toLocaleString()})`
        });
      }

      // Validation 4: Payment amount cannot exceed pending amount
      if (paymentData.amount > entry.pendingAmount) {
        return res.status(400).json({
          message: `Payment amount (₹${paymentData.amount.toLocaleString()}) cannot exceed pending amount (₹${entry.pendingAmount.toLocaleString()})`
        });
      }

      // Validation 5: Payment amount must be greater than 0
      if (paymentData.amount <= 0) {
        return res.status(400).json({ message: "Payment amount must be greater than ₹0" });
      }

      // Validation 6: Critical pre-check - Calculate what new total WOULD be and reject before any writes
      // This protects against race conditions and stale data
      const currentPayments = entry.payments || [];
      const newReceivedAmount = currentPayments.reduce((sum, p) => sum + p.amount, 0) + paymentData.amount;

      if (newReceivedAmount > entry.totalAmount) {
        return res.status(400).json({
          message: `Payment rejected: Total received amount would be ₹${newReceivedAmount.toLocaleString()}, exceeding total boli amount of ₹${entry.totalAmount.toLocaleString()}`
        });
      }

      // Import query for database operations
      const { query } = await import("./db");

      // Generate unified sequential receipt number based on the year - SPDJMSJ-YYYY-XXXXX
      const receiptNo = await generateUnifiedReceiptNumber(paymentData.date);

      // For advance payments, verify balance BEFORE any writes (but don't create usage record yet)
      if (paymentData.mode === PaymentMode.ADVANCE_PAYMENT) {
        const availableBalance = await calculateRemainingAdvancePayment(entry.userId);
        if (availableBalance < paymentData.amount) {
          return res.status(400).json({
            message: `Insufficient advance balance. Available: ₹${availableBalance.toLocaleString()}, Required: ₹${paymentData.amount.toLocaleString()}`
          });
        }
      }

      const payment = {
        date: paymentData.date,
        amount: paymentData.amount,
        mode: paymentData.mode || PaymentMode.CASH,
        fileUrl: paymentData.fileUrl,
        receiptNo: receiptNo, // Add unique receipt number
        updatedBy: user.username // Add updatedBy field
      };

      // Get the current entry again to ensure we have the latest data
      const entryToUpdate = await storage.getEntry(entryId);
      if (!entryToUpdate) {
        return res.status(404).json({ message: "Entry not found" });
      }

      // Update the entry with the new payment
      const updatedPayments = [...(entryToUpdate.payments || []), payment];

      // Recalculate amounts (using the fresh entry data)
      const finalReceivedAmount = updatedPayments.reduce((sum, p) => sum + p.amount, 0);
      const finalPendingAmount = entryToUpdate.totalAmount - finalReceivedAmount;

      // CRITICAL: Second validation check after re-fetching entry to protect against race conditions
      // If another payment was added between the pre-check and now, this will catch it
      if (finalReceivedAmount > entryToUpdate.totalAmount) {
        return res.status(409).json({
          message: `Payment rejected due to concurrent update: Total received amount would be ₹${finalReceivedAmount.toLocaleString()}, exceeding total boli amount of ₹${entryToUpdate.totalAmount.toLocaleString()}. Please retry.`
        });
      }

      // NOW it's safe to create the advance payment usage record (after all validations passed)
      if (paymentData.mode === PaymentMode.ADVANCE_PAYMENT) {
        const usageSql = `
          INSERT INTO advance_payment_usage (
            user_id, entry_id, amount, date, created_by
          ) VALUES ($1, $2, $3, $4, $5)
        `;

        const usageValues = [
          entryToUpdate.userId,
          entryId,
          paymentData.amount,
          paymentData.date,
          user.username
        ];

        await query(usageSql, usageValues);
        console.log(`Created advance payment usage record: User ${entryToUpdate.userId}, Amount ${paymentData.amount}, Entry ${entryId}`);
      }

      // Determine payment status based on final amounts
      let newStatus = entryToUpdate.status;
      if (finalReceivedAmount === 0) {
        newStatus = PaymentStatus.PENDING;
      } else if (finalReceivedAmount < entryToUpdate.totalAmount) {
        newStatus = PaymentStatus.PARTIAL;
      } else {
        newStatus = PaymentStatus.FULL;
      }

      // Update the entry with SQL to ensure proper column names
      const updateSql = `
        UPDATE entries 
        SET payments = $1, 
            received_amount = $2, 
            pending_amount = $3,
            status = $4
        WHERE id = $5
        RETURNING *
      `;

      const updateValues = [
        JSON.stringify(updatedPayments),
        finalReceivedAmount,
        finalPendingAmount,
        newStatus,
        entryId
      ];

      const updateResult = await query(updateSql, updateValues);
      const updatedEntry = updateResult.rows[0];

      // Log the payment with DEBIT transaction type
      // Use direct SQL query to ensure transaction_type is correctly set
      const logSql = `
        INSERT INTO transaction_logs (
          entry_id, user_id, username, description, 
          amount, transaction_type, details, date, timestamp
        ) VALUES (
          $1, $2, $3, $4, 
          $5, $6, $7, $8, $9
        )
      `;

      const logValues = [
        entryId,
        user.id,
        user.username,
        `Payment of ₹${payment.amount} recorded by ${user.username}`,
        payment.amount,
        'debit', // Explicitly setting transaction_type to 'debit'
        JSON.stringify({
          date: payment.date,
          paymentMode: payment.mode,
          receiptNo: payment.receiptNo
        }),
        new Date().toISOString().split('T')[0],
        new Date().toISOString()
      ];

      await query(logSql, logValues);

      // If status has changed, log that too
      if (entryToUpdate.status !== newStatus) {
        const statusLogSql = `
          INSERT INTO transaction_logs (
            entry_id, user_id, username, description, 
            amount, transaction_type, details, date, timestamp
          ) VALUES (
            $1, $2, $3, $4, 
            $5, $6, $7, $8, $9
          )
        `;

        const statusLogValues = [
          entryId,
          user.id,
          user.username,
          `Payment status changed from ${entryToUpdate.status} to ${newStatus}`,
          0,
          'update_payment', // Explicitly setting transaction_type
          JSON.stringify({
            payment,
            oldStatus: entryToUpdate.status,
            newStatus
          }),
          new Date().toISOString().split('T')[0],
          new Date().toISOString()
        ];

        await query(statusLogSql, statusLogValues);
      }

      // Convert the response to match our expected schema format
      const mappedEntry = {
        ...updatedEntry,
        userId: updatedEntry.user_id,
        userName: updatedEntry.user_name,
        userMobile: updatedEntry.user_mobile,
        userAddress: updatedEntry.user_address,
        totalAmount: updatedEntry.total_amount,
        pendingAmount: updatedEntry.pending_amount,
        receivedAmount: updatedEntry.received_amount,
        auctionDate: updatedEntry.auction_date,
        updatedAt: updatedEntry.updated_at,
        createdBy: updatedEntry.created_by
      };

      // Get the user for whom the payment was recorded
      const entryUser = await storage.getUser(entryToUpdate.userId);

      // If user exists, send notification
      if (entryUser) {
        // Import is done inside the handler to avoid circular dependencies
        const { NotificationService } = await import("./notification");
        NotificationService.notifyPaymentRecorded(entryUser, mappedEntry, payment);

        // If payment status changed, notify that as well
        if (entryToUpdate.status !== newStatus) {
          NotificationService.notifyPaymentStatusChanged(
            entryUser,
            mappedEntry,
            entryToUpdate.status,
            newStatus
          );
        }
      }

      res.json(mappedEntry);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: fromZodError(error).message });
      }
      res.status(500).json({ message: "Failed to record payment" });
    }
  });

  // Daily earnings calendar endpoint
  app.get("/api/daily-earnings", isAuthenticated, async (req, res) => {
    try {
      const { year } = req.query;
      const selectedYear = year ? parseInt(year as string) : new Date().getFullYear();

      // Get entries from the selected year
      const { query } = await import("./db");

      const sql = `
        SELECT 
          auction_date as date,
          SUM(total_amount) as daily_total
        FROM entries 
        WHERE auction_date LIKE $1
        GROUP BY auction_date
        ORDER BY auction_date
      `;

      const result = await query(sql, [`${selectedYear}-%`]);

      // Transform data into a format easy to use in the frontend
      const dailyEarnings: { [key: string]: number } = {};
      result.rows.forEach(row => {
        dailyEarnings[row.date] = parseInt(row.daily_total);
      });

      console.log(`Daily earnings for ${selectedYear}:`, dailyEarnings);

      res.json(dailyEarnings);
    } catch (error) {
      console.error("Error fetching daily earnings:", error);
      res.status(500).json({ message: "Failed to fetch daily earnings data" });
    }
  });

  // Daily payments calendar endpoint
  app.get('/api/daily-payments', isAuthenticated, async (req, res) => {
    try {
      const { year } = req.query;
      const selectedYear = year ? parseInt(year as string) : new Date().getFullYear();

      // Get all entries with payments for the selected year
      const entries = await storage.getEntries();

      // Extract payment records and group by payment date
      const dailyPayments: { [key: string]: number } = {};

      entries.forEach(entry => {
        if (entry.payments && entry.payments.length > 0) {
          entry.payments.forEach(payment => {
            // Check if payment date is in the selected year
            if (payment.date.startsWith(selectedYear.toString())) {
              if (!dailyPayments[payment.date]) {
                dailyPayments[payment.date] = 0;
              }
              dailyPayments[payment.date] += payment.amount;
            }
          });
        }
      });

      console.log(`Daily payments for ${selectedYear}:`, dailyPayments);

      res.json(dailyPayments);
    } catch (error) {
      console.error("Error fetching daily payments:", error);
      res.status(500).json({ message: "Failed to fetch daily payments data" });
    }
  });

  // Get all boli payments from boli_payments table
  app.get("/api/boli-payments", isAuthenticated, async (req, res) => {
    try {
      const { status } = req.query;
      const { query } = await import("./db");

      let sql = `
        SELECT 
          bp.*,
          e.user_name,
          e.user_mobile,
          e.description as entry_description
        FROM boli_payments bp
        LEFT JOIN entries e ON bp.entry_id = e.id
        WHERE 1=1
      `;

      const params: any[] = [];

      // Filter by status if provided
      if (status && status !== 'all') {
        sql += ` AND bp.status = $${params.length + 1}`;
        params.push(status);
      }

      sql += ' ORDER BY bp.created_at DESC, bp.id DESC';

      const result = await query(sql, params);

      // Map to camelCase for consistency
      const payments = result.rows.map(row => ({
        id: row.id,
        entryId: row.entry_id,
        entrySerialNumber: row.entry_serial_number,
        receiptNumber: row.receipt_number,
        amount: row.amount,
        date: row.date,
        mode: row.mode,
        fileUrl: row.file_url,
        updatedBy: row.updated_by,
        status: row.status,
        createdAt: row.created_at,
        userName: row.user_name,
        userMobile: row.user_mobile,
        entryDescription: row.entry_description
      }));

      res.json(payments);
    } catch (error) {
      console.error("Error fetching boli payments:", error);
      res.status(500).json({ message: "Failed to fetch boli payments" });
    }
  });

  // Dashboard summary route with date range filtering - restricted to admin/operator only
  app.get("/api/dashboard", isAdminOrOperator, async (req, res) => {
    try {
      const user = req.user as any;
      const { startDate, endDate } = req.query;

      // Only admin and operator can access dashboard data
      const entries = await storage.getEntries();

      // Filter entries by date range if provided
      let filteredEntries = entries;
      if (startDate || endDate) {
        filteredEntries = entries.filter(entry => {
          const entryDate = new Date(entry.auctionDate);
          const start = startDate ? new Date(startDate as string) : null;
          const end = endDate ? new Date((endDate as string) + ' 23:59:59') : null;

          return (!start || entryDate >= start) && (!end || entryDate <= end);
        });
      }

      const totalAmount = filteredEntries.reduce((sum, entry) => sum + entry.totalAmount, 0);
      const receivedAmount = filteredEntries.reduce((sum, entry) => sum + entry.receivedAmount, 0);
      const pendingAmount = filteredEntries.reduce((sum, entry) => sum + entry.pendingAmount, 0);

      const pendingEntries = filteredEntries.filter(entry => entry.status === PaymentStatus.PENDING).length;
      const partialEntries = filteredEntries.filter(entry => entry.status === PaymentStatus.PARTIAL).length;
      const completedEntries = filteredEntries.filter(entry => entry.status === PaymentStatus.FULL).length;

      // Get remaining advance payments (only for admin/operator, viewers get 0)
      let totalAdvancePayments = 0;
      if (user.role === "admin" || user.role === "operator") {
        try {
          const { query } = await import("./db");

          // Get all users with advance payments (don't filter by date - we want all users with any advance payments)
          const usersWithAdvance = await query(`
            SELECT DISTINCT user_id FROM advance_payments
          `);

          // Calculate remaining balance for each user
          for (const userRow of usersWithAdvance.rows) {
            const remainingBalance = await calculateRemainingAdvancePayment(userRow.user_id);
            // Only add positive balances (users can't have negative advance balances)
            if (remainingBalance > 0) {
              totalAdvancePayments += remainingBalance;
            }
          }

          console.log("Dashboard advance payments calculation:", {
            usersChecked: usersWithAdvance.rows.length,
            totalAdvancePayments
          });
        } catch (error) {
          console.error("Error calculating advance payments for dashboard:", error);
          totalAdvancePayments = 0; // Set to 0 if there's an error
        }
      }

      // Sort entries by date (most recent first)
      const recentActivity = [...entries]
        .sort((a, b) => new Date(b.auctionDate).getTime() - new Date(a.auctionDate).getTime())
        .slice(0, 5);

      // Get corpus settings for overall summary calculation
      let corpusValue = 0;
      try {
        const corpusResult = await query('SELECT corpus_value FROM corpus_settings LIMIT 1');
        corpusValue = corpusResult.rows[0]?.corpus_value || 0;
      } catch (error) {
        console.log("No corpus settings found, using default value 0");
      }

      // Get total expenses (unfiltered by date range)
      let totalExpenses = 0;
      try {
        const expensesResult = await query('SELECT SUM(amount) as total FROM expense_entries');
        totalExpenses = parseInt(expensesResult.rows[0]?.total) || 0;
      } catch (error) {
        console.error("Error calculating total expenses:", error);
      }

      // Get total received outstanding payments from all users
      let totalReceivedOutstanding = 0;
      try {
        const { query } = await import("./db");
        const result = await query(`
          SELECT COALESCE(SUM(received_amount), 0) as total_received_outstanding
          FROM previous_outstanding_records
        `);
        totalReceivedOutstanding = parseInt(result.rows[0].total_received_outstanding) || 0;
      } catch (error) {
        console.error("Error calculating received outstanding:", error);
        totalReceivedOutstanding = 0;
      }

      // Calculate cash in bank: ₹139,084 + ₹4,831 + ₹43,231 - ₹7,284 + Total Received Outstanding Payment
      // Expenses are stored in rupees, calculate directly
      const cashInBank = corpusValue + receivedAmount + totalAdvancePayments - totalExpenses + totalReceivedOutstanding;

      res.json({
        summary: {
          totalAmount,
          receivedAmount,
          pendingAmount,
          pendingEntries,
          partialEntries,
          completedEntries,
          totalAdvancePayments
        },
        overallSummary: {
          corpusValue,
          totalReceived: receivedAmount,
          totalAdvancePayments,
          totalExpenses,
          totalReceivedOutstanding,
          cashInBank
        },
        recentActivity
      });
    } catch (error) {
      console.error("Dashboard error:", error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ message: "Failed to fetch dashboard data", error: errorMessage });
    }
  });

  // Database backup API - only for operators and admins
  app.post("/api/database/backup", isAdminOrOperator, async (req, res) => {
    try {
      const currentUser = req.user as any;
      console.log(`Database backup requested by ${currentUser.username} (${currentUser.role})`);

      const xlsx = await import("xlsx");
      const nodemailer = await import("nodemailer");
      const path = await import("path");
      const fs = await import("fs");
      const { query } = await import("./db");

      // Create workbook
      const workbook = xlsx.utils.book_new();

      // Get all tables data with ALL columns as they exist in database (for emergency restore)
      const tables = [
        { name: "Users", query: "SELECT id, serial_number, username, password, name, email, mobile, address, role, status FROM users ORDER BY id" },
        { name: "Entries", query: "SELECT id, user_id, user_name, user_mobile, user_address, description, amount, quantity, total_amount, occasion, bedi_number, auction_date, status, pending_amount, received_amount, payments, updated_at, created_by FROM entries ORDER BY id" },
        { name: "Dravya_Entries", query: "SELECT id, user_id, user_name, user_mobile, user_address, description, occasion, entry_date, created_by, updated_at FROM dravya_entries ORDER BY id" },
        { name: "Expense_Entries", query: "SELECT id, firm_name, bill_no, bill_date, description, amount, quantity, reason, expense_date, payment_mode, attachment_url, approved_by, paid_by, created_by, updated_at FROM expense_entries ORDER BY id" },
        { name: "Advance_Payments", query: "SELECT id, user_id, user_name, user_mobile, date, amount, payment_mode, attachment_url, receipt_no, created_by, created_at FROM advance_payments ORDER BY id" },
        { name: "Advance_Payment_Usage", query: "SELECT id, user_id, entry_id, amount, date, created_by, created_at FROM advance_payment_usage ORDER BY id" },
        { name: "Boli_Payments", query: "SELECT id, entry_id, entry_serial_number, receipt_number, amount, date, mode, file_url, updated_by, status, created_at FROM boli_payments ORDER BY id" },
        { name: "Previous_Outstanding_Records", query: "SELECT id, serial_number, record_number, user_id, user_name, user_mobile, user_address, outstanding_amount, received_amount, pending_amount, status, payments, description, attachment_url, attachment_name, created_by, created_at, updated_at FROM previous_outstanding_records ORDER BY id" },
        { name: "Transaction_Logs", query: "SELECT id, entry_id, user_id, username, transaction_type, amount, description, date, details, timestamp FROM transaction_logs ORDER BY id" },
        { name: "Corpus_Settings", query: "SELECT id, corpus_value, base_date, updated_at, updated_by FROM corpus_settings ORDER BY id" }
      ];

      // Export each table as a worksheet
      for (const table of tables) {
        try {
          const result = await query(table.query);
          const worksheet = xlsx.utils.json_to_sheet(result.rows);
          xlsx.utils.book_append_sheet(workbook, worksheet, table.name);
          console.log(`Exported ${result.rows.length} rows from ${table.name}`);
        } catch (tableError) {
          console.error(`Error exporting ${table.name}:`, tableError);
          // Create empty sheet for failed table
          const emptySheet = xlsx.utils.json_to_sheet([{ error: `Failed to export ${table.name}` }]);
          xlsx.utils.book_append_sheet(workbook, emptySheet, table.name);
        }
      }

      // Generate filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
      const filename = `Database_Backup_${timestamp}.xlsx`;
      const filepath = path.join(process.cwd(), 'uploads', filename);

      // Write Excel file
      xlsx.writeFile(workbook, filepath);
      console.log(`Backup file created: ${filename}`);

      // Get all operators for email distribution
      const operatorResult = await query(
        "SELECT email, name FROM users WHERE role IN ('operator', 'admin') AND email IS NOT NULL AND email != ''"
      );

      if (operatorResult.rows.length === 0) {
        console.log("No operators found for email distribution, proceeding with download only");
      }

      // Check if SendGrid API key is available
      if (!process.env.SENDGRID_API_KEY) {
        console.log("SendGrid API key not found, skipping email sending");
        return res.json({
          message: "Database backup created successfully. Email functionality requires SendGrid API key.",
          filename,
          operatorCount: operatorResult.rows.length,
          downloadUrl: `/uploads/${filename}`
        });
      }


      // Configure nodemailer with SendGrid
      const transporter = nodemailer.createTransport({
        host: 'smtp.sendgrid.net',
        port: 587,
        secure: false,
        auth: {
          user: 'apikey',
          pass: process.env.SENDGRID_API_KEY
        }
      });

      // Email configuration
      const emailOptions = {
        from: 'noreply@shivnagarjaintemple.org',
        subject: `Database Backup - ${new Date().toLocaleDateString('en-IN')}`,
        html: `
          <h2>श्री शिवनगर जैन मंदिर समिति - Database Backup</h2>
          <p>Dear Temple Administrator,</p>
          <p>A database backup has been automatically generated and is attached to this email.</p>
          
          <h3>Backup Details:</h3>
          <ul>
            <li><strong>Generated by:</strong> ${currentUser.name} (${currentUser.username})</li>
            <li><strong>Date & Time:</strong> ${new Date().toLocaleString('en-IN')}</li>
            <li><strong>File Size:</strong> ${Math.round(fs.statSync(filepath).size / 1024)} KB</li>
          </ul>
          
          <h3>Included Data:</h3>
          <ul>
            <li>Users Management</li>
            <li>Boli Entries & Payments</li>
            <li>Advance Payments</li>
            <li>Dravya Entries</li>
            <li>Expense Entries</li>
            <li>Transaction Logs</li>
          </ul>
          
          <p><strong>Note:</strong> Please store this backup file securely and delete it from your email after downloading.</p>
          <p>This is an automated email from the Temple Management System.</p>
          
          <hr>
          <small>श्री शिवनगर जैन मंदिर समिति, शिवनगर, जबलपुर</small>
        `,
        attachments: [{
          filename: filename,
          path: filepath
        }]
      };

      // Send email to all operators
      const emailPromises = operatorResult.rows.map(operator => {
        return transporter.sendMail({
          ...emailOptions,
          to: operator.email,
          // Personalize greeting
          html: emailOptions.html.replace('Dear Temple Administrator', `Dear ${operator.name}`)
        });
      });
      await Promise.all(emailPromises);
      console.log(`Backup email sent to ${operatorResult.rows.length} operators`);

      // Send the backup file for download
      res.download(filepath, filename, (downloadErr) => {
        if (downloadErr) {
          console.error('Error sending backup file:', downloadErr);
          res.status(500).json({ message: 'Failed to send backup file' });
        }
      });

    } catch (error) {
      console.error("Database backup error:", error);
      res.status(500).json({
        message: "Failed to create database backup",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Previous Outstanding Records API routes
  app.get("/api/previous-outstanding", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { userId } = req.query;

      let records;
      if (userId) {
        records = await db.select().from(previousOutstandingRecords)
          .where(eq(previousOutstandingRecords.userId, parseInt(userId as string)));
      } else {
        records = await db.select().from(previousOutstandingRecords);
      }

      // For each record, use the stored receivedAmount and pendingAmount from database
      // (calculating from payments array would give 0 for legacy records with empty payments array)
      const recordsWithPayments = records.map((record, index) => {
        // Use receivedAmount from database if it exists, otherwise calculate from payments
        const receivedAmount = record.receivedAmount || 0;
        // Always recalculate pendingAmount to ensure accuracy (database value may be wrong)
        const pendingAmount = Math.max(0, record.outstandingAmount - receivedAmount);

        // Determine status based on amounts
        let status: 'pending' | 'partial' | 'full' = 'pending';
        if (receivedAmount >= record.outstandingAmount) {
          status = 'full';
        } else if (receivedAmount > 0) {
          status = 'partial';
        }

        return {
          ...record,
          receivedAmount,
          pendingAmount,
          status
        };
      });

      res.json(recordsWithPayments);
    } catch (error) {
      console.error("Error fetching previous outstanding records:", error);
      res.status(500).json({ message: "Failed to fetch previous outstanding records" });
    }
  });

  // Update previous outstanding record
  app.patch("/api/previous-outstanding/:id", isAdminOrOperator, upload.single('attachmentFile'), async (req: Request, res: Response) => {
    try {
      const recordId = parseInt(req.params.id);
      const { outstandingAmount, userId, description } = req.body;
      const currentUser = req.user as any;


      // Get the existing record
      const [existingRecord] = await db.select().from(previousOutstandingRecords)
        .where(eq(previousOutstandingRecords.id, recordId));

      if (!existingRecord) {
        return res.status(404).json({ message: "Record not found" });
      }

      // Calculate current received amount from payments
      const payments = existingRecord.payments || [];
      const receivedAmount = payments.reduce((sum: number, payment: any) => sum + payment.amount, 0);

      // Prepare update data
      const updateData: any = {
        updatedAt: new Date().toISOString()
      };

      // Update amount if provided
      if (outstandingAmount !== undefined) {
        const amount = parseFloat(outstandingAmount);
        if (isNaN(amount) || amount < 0) {
          return res.status(400).json({ message: "Invalid outstanding amount" });
        }

        // Check if amount is less than already received
        if (amount < receivedAmount) {
          return res.status(400).json({
            message: `Outstanding amount cannot be less than already received amount of ₹${receivedAmount.toLocaleString()}`
          });
        }

        updateData.outstandingAmount = Math.round(amount); // Store in rupees

        // Recalculate pending amount and status
        const newPendingAmount = Math.round(amount) - receivedAmount;
        updateData.pendingAmount = Math.max(0, newPendingAmount);

        // Update status based on new amounts
        if (newPendingAmount <= 0) {
          updateData.status = PaymentStatus.FULL;
        } else if (receivedAmount > 0) {
          updateData.status = PaymentStatus.PARTIAL;
        } else {
          updateData.status = PaymentStatus.PENDING;
        }
      }

      // Admin-only updates
      if (currentUser.role === 'admin') {
        // Update user if provided
        if (userId && parseInt(userId) !== existingRecord.userId) {
          const [newUser] = await db.select().from(users)
            .where(eq(users.id, parseInt(userId)));

          if (!newUser) {
            return res.status(400).json({ message: "Invalid user selected" });
          }

          updateData.userId = newUser.id;
          updateData.userName = newUser.name;
          updateData.userMobile = newUser.mobile || '';
          updateData.userAddress = newUser.address || '';
        }

        // Update description if provided
        if (description !== undefined) {
          updateData.description = description;
        }
      }

      // Handle file upload if provided
      if (req.file) {
        updateData.attachmentUrl = `/uploads/${req.file.filename}`;
        updateData.attachmentName = req.file.originalname;
      }

      // Update the record
      const [updatedRecord] = await db.update(previousOutstandingRecords)
        .set(updateData)
        .where(eq(previousOutstandingRecords.id, recordId))
        .returning();

      res.json({
        message: "Record updated successfully",
        record: updatedRecord
      });
    } catch (error) {
      console.error("Error updating previous outstanding record:", error);
      res.status(500).json({ message: "Failed to update record" });
    }
  });

  // Edit previous outstanding record (new comprehensive endpoint)
  app.post("/api/previous-outstanding/edit", isAdminOrOperator, upload.single('file'), async (req: Request, res: Response) => {
    try {
      const { recordId, amount, userId, description } = req.body;
      const currentUser = req.user as any;

      if (!recordId) {
        return res.status(400).json({ message: "Record ID is required" });
      }

      // Get the existing record
      const [existingRecord] = await db.select().from(previousOutstandingRecords)
        .where(eq(previousOutstandingRecords.id, parseInt(recordId)));

      if (!existingRecord) {
        return res.status(404).json({ message: "Record not found" });
      }

      // Prepare update data
      const updateData: any = {
        updatedAt: new Date().toISOString()
      };

      // Update amount (both admin and operator can do this)
      if (amount !== undefined) {
        const amountFloat = parseFloat(amount);
        if (isNaN(amountFloat) || amountFloat < 0) {
          return res.status(400).json({ message: "Invalid outstanding amount" });
        }

        // Check if amount is less than already received
        if (amountFloat < existingRecord.receivedAmount) {
          return res.status(400).json({
            message: `Outstanding amount cannot be less than already received amount of ₹${existingRecord.receivedAmount.toLocaleString()}`
          });
        }

        updateData.outstandingAmount = Math.round(amountFloat);

        // Recalculate pending amount and status
        const newPendingAmount = Math.round(amountFloat) - existingRecord.receivedAmount;
        updateData.pendingAmount = Math.max(0, newPendingAmount);

        // Update status based on new amounts
        if (newPendingAmount <= 0) {
          updateData.status = PaymentStatus.FULL;
        } else if (existingRecord.receivedAmount > 0) {
          updateData.status = PaymentStatus.PARTIAL;
        } else {
          updateData.status = PaymentStatus.PENDING;
        }
      }

      // Admin-only fields
      if (currentUser.role === 'admin') {
        // Update user assignment if provided and different
        if (userId && parseInt(userId) !== existingRecord.userId) {
          const [targetUser] = await db.select().from(users)
            .where(eq(users.id, parseInt(userId)));

          if (!targetUser) {
            return res.status(400).json({ message: "Invalid user selected" });
          }

          updateData.userId = parseInt(userId);
          updateData.userName = targetUser.name;
          updateData.userMobile = targetUser.mobile;
          updateData.userAddress = targetUser.address;

          // If user is changed, also update payment records to reflect the new user
          if (existingRecord.payments && existingRecord.payments.length > 0) {
            const updatedPayments = existingRecord.payments.map((payment: any) => ({
              ...payment,
              // Keep the payment data but note that user changed
            }));
            updateData.payments = updatedPayments;
          }
        }

        // Update description if provided and different
        if (description !== undefined && description !== existingRecord.description) {
          updateData.description = description;
        }
      }

      // Handle file upload (both admin and operator can do this)
      if (req.file) {
        // Update the first payment record with the new file if payments exist
        if (existingRecord.payments && existingRecord.payments.length > 0) {
          const updatedPayments = [...existingRecord.payments];
          updatedPayments[0] = {
            ...updatedPayments[0],
            fileUrl: `/uploads/${req.file.filename}`,
            updatedBy: currentUser.username
          };
          updateData.payments = updatedPayments;
        } else {
          // If no payments exist, store file URL in attachment fields for now
          updateData.attachmentUrl = `/uploads/${req.file.filename}`;
          updateData.attachmentName = req.file.originalname;
        }
      }

      // Update the record
      const [updatedRecord] = await db.update(previousOutstandingRecords)
        .set(updateData)
        .where(eq(previousOutstandingRecords.id, parseInt(recordId)))
        .returning();

      res.json({
        message: "Record updated successfully",
        record: updatedRecord
      });
    } catch (error) {
      console.error("Error updating previous outstanding record:", error);
      res.status(500).json({ message: "Failed to update record" });
    }
  });

  // Get single previous outstanding record
  app.get("/api/previous-outstanding/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const recordId = parseInt(req.params.id);

      const [record] = await db.select({
        id: previousOutstandingRecords.id,
        serialNumber: previousOutstandingRecords.serialNumber,
        recordNumber: previousOutstandingRecords.recordNumber,
        userId: previousOutstandingRecords.userId,
        userName: users.name,
        description: previousOutstandingRecords.description,
        outstandingAmount: previousOutstandingRecords.outstandingAmount,
        attachmentUrl: previousOutstandingRecords.attachmentUrl,
        attachmentName: previousOutstandingRecords.attachmentName,
        payments: previousOutstandingRecords.payments,
        createdAt: previousOutstandingRecords.createdAt,
        updatedAt: previousOutstandingRecords.updatedAt,
      })
        .from(previousOutstandingRecords)
        .leftJoin(users, sql`${previousOutstandingRecords.userId} = CAST(${users.id} AS INTEGER)`)
        .where(eq(previousOutstandingRecords.id, recordId));

      if (!record) {
        return res.status(404).json({ message: "Previous outstanding record not found" });
      }

      // Calculate totals from existing payments array
      const payments = record.payments || [];
      const receivedAmount = payments.reduce((sum: number, payment: any) => sum + payment.amount, 0);
      const pendingAmount = Math.max(0, record.outstandingAmount - receivedAmount);

      // Determine status
      let status: 'pending' | 'partial' | 'full' = 'pending';
      if (receivedAmount >= record.outstandingAmount) {
        status = 'full';
      } else if (receivedAmount > 0) {
        status = 'partial';
      }

      const result = {
        ...record,
        userName: record.userName || `User ID ${record.userId}`, // Fallback if user not found
        receivedAmount,
        pendingAmount,
        status,
        payments: payments.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
      };

      res.json(result);
    } catch (error) {
      console.error("Error fetching previous outstanding record:", error);
      res.status(500).json({ message: "Failed to fetch previous outstanding record" });
    }
  });


  // Edit previous outstanding record (admin only)
  // Get all previous outstanding payments
  app.get("/api/previous-outstanding-payments", isAuthenticated, isAdminOrOperator, async (req: Request, res: Response) => {
    try {
      // Get all previous outstanding records that have payments
      const records = await db.select().from(previousOutstandingRecords);

      // Flatten all payments with user details
      const allPayments: any[] = [];

      for (const record of records) {
        // If record has payments array, use it
        if (record.payments && Array.isArray(record.payments) && record.payments.length > 0) {
          record.payments.forEach((payment, paymentIndex) => {
            allPayments.push({
              id: `${record.id}-payment-${paymentIndex}`,
              recordId: record.id,
              recordNumber: record.recordNumber,
              userId: record.userId,
              userName: record.userName,
              userMobile: record.userMobile,
              userAddress: record.userAddress,
              outstandingAmount: record.outstandingAmount,
              receivedAmount: record.receivedAmount,
              pendingAmount: record.pendingAmount,
              status: record.status,
              paymentDate: payment.date,
              paymentAmount: payment.amount,
              paymentMode: payment.mode,
              receiptNo: payment.receiptNo || 'No Receipt Generated',
              fileUrl: payment.fileUrl,
              updatedBy: payment.updatedBy,
              description: record.description,
              createdBy: record.createdBy,
              createdAt: record.createdAt
            });
          });
        }
        // If record has receivedAmount but no payments array, create a synthetic entry
        else if (record.receivedAmount > 0) {
          allPayments.push({
            id: `${record.id}-payment-legacy`,
            recordId: record.id,
            recordNumber: record.recordNumber,
            userId: record.userId,
            userName: record.userName,
            userMobile: record.userMobile,
            userAddress: record.userAddress,
            outstandingAmount: record.outstandingAmount,
            receivedAmount: record.receivedAmount,
            pendingAmount: record.pendingAmount,
            status: record.status,
            paymentDate: record.createdAt,
            paymentAmount: record.receivedAmount,
            paymentMode: 'cash',
            receiptNo: 'Legacy Payment',
            fileUrl: null,
            updatedBy: record.createdBy,
            description: record.description,
            createdBy: record.createdBy,
            createdAt: record.createdAt
          });
        }
      }

      // Sort by payment date (newest first)
      allPayments.sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime());

      res.json(allPayments);
    } catch (error) {
      console.error("Error fetching previous outstanding payments:", error);
      res.status(500).json({ message: "Failed to fetch previous outstanding payments" });
    }
  });

  // Generate receipt numbers for payments that don't have them and revise existing ones to new block system
  app.post("/api/previous-outstanding-payments/generate-receipts", isAuthenticated, isAdminOrOperator, async (req: Request, res: Response) => {
    try {
      const records = await db.select().from(previousOutstandingRecords);
      let updatedCount = 0;
      let revisedCount = 0;

      // First pass: collect all existing numbers to understand current state
      const existingNumbers = new Set<number>();
      const allPayments: any[] = [];

      for (const record of records) {
        if (!record.payments || !Array.isArray(record.payments)) continue;

        for (const payment of record.payments) {
          allPayments.push({ recordId: record.id, payment, index: allPayments.length });

          if (payment.receiptNo) {
            const match = payment.receiptNo.match(/SPDJMSJ-(\d{4})-(\d{5})/);
            if (match) {
              const foundNumber = parseInt(match[2], 10);
              if (!isNaN(foundNumber)) {
                existingNumbers.add(foundNumber);
              }
            }
          }
        }
      }

      // Get boli payment numbers to avoid conflicts
      const boliLogs = await db.select()
        .from(transactionLogs)
        .where(eq(transactionLogs.transactionType, TransactionType.DEBIT))
        .orderBy(desc(transactionLogs.id))
        .limit(200);

      for (const log of boliLogs) {
        if (!log.details) continue;

        const details = typeof log.details === 'string'
          ? JSON.parse(log.details)
          : log.details;

        if (!details.receiptNo) continue;

        if (typeof details.receiptNo === 'string' &&
          details.receiptNo.startsWith(`AM-2025-`)) {

          const match = details.receiptNo.match(/AM-\d{4}-(\d{5})/);
          if (match && match[1]) {
            const foundNumber = parseInt(match[1], 10);
            if (!isNaN(foundNumber)) {
              existingNumbers.add(foundNumber);
            }
          }
        }
      }

      // Generate new numbers starting from 201 for outstanding payments
      let nextOutstandingNumber = 201;
      const getNextValidOutstandingNumber = () => {
        // Outstanding payment ranges: 201-300, 501-600, 901-1000, etc.
        const ranges = [
          { start: 201, end: 300 },
          { start: 501, end: 600 },
          { start: 901, end: 1000 },
          { start: 1301, end: 1400 },
          { start: 1701, end: 1800 }
        ];

        for (const range of ranges) {
          for (let num = range.start; num <= range.end; num++) {
            if (!existingNumbers.has(num)) {
              existingNumbers.add(num);
              return num;
            }
          }
        }

        // Fallback to continuing pattern
        let rangeStart = 2101;
        while (true) {
          for (let num = rangeStart; num <= rangeStart + 99; num++) {
            if (!existingNumbers.has(num)) {
              existingNumbers.add(num);
              return num;
            }
          }
          rangeStart += 400;
        }
      };

      // Now update all payments with new sequential numbers
      const recordUpdates = new Map();

      for (const { recordId, payment, index } of allPayments) {
        const year = payment.date.split('-')[0];
        const newNumber = getNextValidOutstandingNumber();
        const newReceiptNo = `SPDJMSJ-${year}-${newNumber.toString().padStart(5, '0')}`;

        if (!recordUpdates.has(recordId)) {
          const record = records.find(r => r.id === recordId);
          recordUpdates.set(recordId, [...(record?.payments || [])]);
        }

        const payments = recordUpdates.get(recordId);
        const paymentIndex = payments.findIndex((p: any) =>
          p.date === payment.date && p.amount === payment.amount
        );

        if (paymentIndex !== -1) {
          const wasEmpty = !payments[paymentIndex].receiptNo;
          payments[paymentIndex] = {
            ...payments[paymentIndex],
            receiptNo: newReceiptNo
          };

          if (wasEmpty) {
            updatedCount++;
          } else {
            revisedCount++;
          }
        }
      }

      // Apply all updates to database
      const recordIds = Array.from(recordUpdates.keys());
      for (const recordId of recordIds) {
        const updatedPayments = recordUpdates.get(recordId);
        await db.update(previousOutstandingRecords)
          .set({
            payments: updatedPayments,
            updatedAt: new Date().toISOString()
          })
          .where(eq(previousOutstandingRecords.id, recordId));
      }

      res.json({
        message: `Updated ${updatedCount} missing receipt numbers and revised ${revisedCount} existing ones to new block system (starting from 201)`,
        updatedCount,
        revisedCount
      });
    } catch (error) {
      console.error("Error generating receipt numbers:", error);
      res.status(500).json({ message: "Failed to generate receipt numbers" });
    }
  });

  app.post("/api/previous-outstanding", isAdminOrOperator, upload.single('attachmentFile'), async (req: Request, res: Response) => {
    try {
      const { userId, userName, userMobile, userAddress, outstandingAmount, description, createdBy } = req.body;

      // Debug logging
      console.log("Raw request body:", req.body);
      console.log("Parsed values:", { userId, userName, userMobile, userAddress, outstandingAmount, description, createdBy });

      // Validate required fields
      const validationData = {
        userId: parseInt(userId) || 0,
        userName: userName || '',
        userMobile: userMobile || '',
        userAddress: userAddress || '',
        outstandingAmount: parseInt(outstandingAmount) || 0, // Amount in rupees
        description: description || 'Previous Outstanding Amount',
        createdBy: createdBy || 'system'
      };

      console.log("Validation data:", validationData);

      const validatedData = insertPreviousOutstandingRecordSchema.parse(validationData);

      // Handle file upload
      let attachmentUrl = null;
      let attachmentName = null;

      if (req.file) {
        const uploadDir = path.join(process.cwd(), 'uploads');
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }

        const filename = `previous-outstanding-${Date.now()}-${req.file.originalname}`;
        const filepath = path.join(uploadDir, filename);

        fs.renameSync(req.file.path, filepath);
        attachmentUrl = `/uploads/${filename}`;
        attachmentName = req.file.originalname;
      }

      // Get the next record number
      const [maxRecord] = await db.select({ maxRecordNumber: max(previousOutstandingRecords.recordNumber) })
        .from(previousOutstandingRecords);
      const nextRecordNumber = (maxRecord.maxRecordNumber || 0) + 1;

      // Create record
      const [record] = await db.insert(previousOutstandingRecords).values({
        ...validatedData,
        recordNumber: nextRecordNumber,
        attachmentUrl,
        attachmentName
      }).returning();

      console.log(`Previous outstanding record created: ₹${validationData.outstandingAmount / 100} for user ${validationData.userName} by ${validationData.createdBy}`);
      res.json(record);
    } catch (error) {
      console.error("Error creating previous outstanding record:", error);
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message });
      }
      res.status(500).json({ message: "Failed to create previous outstanding record" });
    }
  });

  // Record payment for previous outstanding record
  app.post("/api/previous-outstanding/:id/payment", isAuthenticated, isAdminOrOperator, upload.single('paymentFile'), async (req: Request, res: Response) => {
    try {
      const recordId = parseInt(req.params.id);
      const { amount, date, mode, receiptNo } = req.body;
      const user = req.user as any;

      // Validate payment data
      const paymentData = {
        entryId: recordId,
        amount: parseInt(amount),
        date,
        mode,
        receiptNo: receiptNo || undefined
      };

      const validatedPayment = recordPaymentSchema.parse(paymentData);

      // Get the previous outstanding record
      const [record] = await db.select().from(previousOutstandingRecords)
        .where(eq(previousOutstandingRecords.id, recordId));

      if (!record) {
        return res.status(404).json({ message: "Previous outstanding record not found" });
      }

      // Validate file upload for non-cash payments
      let fileUrl = null;
      if (req.file) {
        fileUrl = `/uploads/${req.file.filename}`;
      }

      // Require file upload for non-cash payment modes
      const nonCashModes = ['upi', 'cheque', 'netbanking', 'bank_transfer'];
      if (nonCashModes.includes(mode.toLowerCase()) && !fileUrl) {
        return res.status(400).json({
          message: "Payment screenshot/proof is required for UPI, Cheque, NetBanking, and Bank Transfer payments"
        });
      }

      // Generate receipt number if not provided
      let receiptNumber = validatedPayment.receiptNo;
      if (!receiptNumber) {
        receiptNumber = await generatePreviousOutstandingReceiptNumber(validatedPayment.date);
      }

      // Create payment record
      const newPayment = {
        date: validatedPayment.date,
        amount: validatedPayment.amount,
        mode: validatedPayment.mode,
        fileUrl: fileUrl || undefined,
        receiptNo: receiptNumber,
        updatedBy: user.username
      };

      // Update the record with new payment
      const updatedPayments = [...(record.payments || []), newPayment];
      const newReceivedAmount = record.receivedAmount + validatedPayment.amount;
      const newPendingAmount = record.outstandingAmount - newReceivedAmount;

      // Determine payment status
      let status: PaymentStatusType;
      if (newPendingAmount <= 0) {
        status = PaymentStatus.FULL;
      } else if (newReceivedAmount > 0) {
        status = PaymentStatus.PARTIAL;
      } else {
        status = PaymentStatus.PENDING;
      }

      // Update the record
      await db.update(previousOutstandingRecords)
        .set({
          payments: updatedPayments,
          receivedAmount: newReceivedAmount,
          pendingAmount: Math.max(0, newPendingAmount),
          status: status,
          updatedAt: new Date().toISOString()
        })
        .where(eq(previousOutstandingRecords.id, recordId));

      res.json({
        message: "Payment recorded successfully",
        payment: newPayment,
        updatedRecord: {
          id: recordId,
          receivedAmount: newReceivedAmount,
          pendingAmount: Math.max(0, newPendingAmount),
          status: status
        }
      });
    } catch (error) {
      console.error("Error recording payment:", error);
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message });
      }
      res.status(500).json({ message: "Failed to record payment" });
    }
  });

  // Download route for differential Excel files
  app.get("/api/download/:filename", (req, res) => {
    try {
      const filename = req.params.filename;
      const filepath = path.join(process.cwd(), filename);

      // Security check - only allow specific files
      const allowedFiles = [
        'Address_Differential_Users.xlsx',
        'Missing_Users_Differential.xlsx',
        'Address_Mobile_Differential_Users.xlsx',
        'Duplicate_Mobile_Users_2025-08-09.xlsx'
      ];

      if (!allowedFiles.includes(filename)) {
        return res.status(404).json({ message: "File not found" });
      }

      if (!fs.existsSync(filepath)) {
        return res.status(404).json({ message: "File not found" });
      }

      // Set appropriate headers for Excel download
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      // Stream the file
      const fileStream = fs.createReadStream(filepath);
      fileStream.pipe(res);

    } catch (error) {
      console.error("Error serving download:", error);
      res.status(500).json({ message: "Failed to download file" });
    }
  });

  // Corpus Settings API endpoints (Admin only)
  app.get("/api/corpus-settings", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;

      // Only allow admin access
      if (user.role !== 'admin') {
        return res.status(403).json({ message: "Access denied. Admin role required." });
      }

      const [settings] = await db.select().from(corpusSettings).limit(1);

      // Return default values if no settings exist
      if (!settings) {
        return res.json({
          corpusValue: 0,
          baseDate: "2025-07-31",
          updatedAt: null,
          updatedBy: null
        });
      }

      res.json(settings);
    } catch (error) {
      console.error("Error fetching corpus settings:", error);
      res.status(500).json({ message: "Failed to fetch corpus settings" });
    }
  });

  app.post("/api/corpus-settings", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;

      // Only allow admin access
      if (user.role !== 'admin') {
        return res.status(403).json({ message: "Access denied. Admin role required." });
      }

      const validatedData = insertCorpusSettingsSchema.parse({
        ...req.body,
        corpusValue: req.body.corpusValue, // Keep as rupees
        updatedBy: user.username
      });

      // Check if settings already exist
      const [existingSettings] = await db.select().from(corpusSettings).limit(1);

      let result;
      if (existingSettings) {
        // Update existing settings
        [result] = await db.update(corpusSettings)
          .set(validatedData)
          .where(eq(corpusSettings.id, existingSettings.id))
          .returning();
      } else {
        // Create new settings
        [result] = await db.insert(corpusSettings).values(validatedData).returning();
      }

      console.log(`Corpus settings updated by ${user.username}: ₹${req.body.corpusValue} as of ${validatedData.baseDate}`);
      res.json(result);
    } catch (error) {
      console.error("Error updating corpus settings:", error);
      if (error instanceof ZodError) {
        return res.status(400).json({ message: fromZodError(error).message });
      }
      res.status(500).json({ message: "Failed to update corpus settings" });
    }
  });

  // Restore previous outstanding records from Excel backup (TEMPORARY - NO AUTH)
  app.post("/api/restore-outstanding", async (req: Request, res: Response) => {
    try {
      const filePath = path.join(process.cwd(), 'uploads/Database_Backup_2025-11-23.xlsx');

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: "Backup file not found" });
      }

      console.log('Reading Excel file...');
      const workbook = xlsx.readFile(filePath);

      if (!workbook.SheetNames.includes('Previous_Outstanding_Records')) {
        return res.status(400).json({
          message: "Sheet 'Previous_Outstanding_Records' not found",
          availableSheets: workbook.SheetNames
        });
      }

      const sheet = workbook.Sheets['Previous_Outstanding_Records'];
      const data = xlsx.utils.sheet_to_json(sheet);

      console.log(`Found ${data.length} records in Excel file`);

      if (data.length === 0) {
        return res.json({ message: "No data to restore", restored: 0 });
      }

      // Clear existing data
      console.log('Clearing existing previous outstanding records...');
      await db.delete(previousOutstandingRecords);

      console.log('Inserting records from backup...');
      let inserted = 0;
      let errors = 0;
      const errorDetails: any[] = [];

      for (const row of data as any[]) {
        try {
          // Parse payments JSON if it exists
          let payments = [];
          if (row.payments) {
            try {
              payments = typeof row.payments === 'string' ? JSON.parse(row.payments) : row.payments;
            } catch (e) {
              console.warn(`Failed to parse payments for record ID ${row.id}`);
            }
          }

          await db.insert(previousOutstandingRecords).values({
            id: row.id || undefined,
            serialNumber: row.serialNumber || row.serial_number || null,
            recordNumber: row.recordNumber || row.record_number || null,
            userId: parseInt(row.userId || row.user_id),
            userName: row.userName || row.user_name,
            userMobile: row.userMobile || row.user_mobile || null,
            userAddress: row.userAddress || row.user_address || null,
            outstandingAmount: parseInt(row.outstandingAmount || row.outstanding_amount || 0),
            receivedAmount: parseInt(row.receivedAmount || row.received_amount || 0),
            pendingAmount: parseInt(row.pendingAmount || row.pending_amount || 0),
            status: (row.status || 'pending') as any,
            payments: payments as any,
            description: row.description || '31.07.2025 तक कुल शेष राशि',
            attachmentUrl: row.attachmentUrl || row.attachment_url || null,
            attachmentName: row.attachmentName || row.attachment_name || null,
            createdBy: row.createdBy || row.created_by || 'system',
            createdAt: row.createdAt || row.created_at || new Date().toISOString(),
            updatedAt: row.updatedAt || row.updated_at || new Date().toISOString(),
          });

          inserted++;
        } catch (error) {
          console.error(`Error inserting record:`, error);
          errors++;
          errorDetails.push({ row, error: error instanceof Error ? error.message : String(error) });
        }
      }

      // Reset sequence
      try {
        await query('SELECT setval(\'previous_outstanding_records_id_seq\', (SELECT MAX(id) FROM previous_outstanding_records))');
        console.log('Reset ID sequence');
      } catch (e) {
        console.warn('Could not reset sequence:', e);
      }

      res.json({
        message: "Restoration complete",
        total: data.length,
        inserted,
        errors,
        errorDetails: errors > 0 ? errorDetails.slice(0, 5) : []
      });

    } catch (error) {
      console.error('Fatal error during restoration:', error);
      res.status(500).json({
        message: "Failed to restore data",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Admin endpoint to fix user sequence (to be called once after data restoration)
  app.post("/api/admin/fix-user-sequence", async (req, res) => {
    try {
      // Get the maximum ID from users table - cast to integer since id is stored as text
      const result = await query('SELECT COALESCE(MAX(CAST(id AS INTEGER)), 0) as max_id FROM users');
      const maxId = parseInt(result.rows[0].max_id);

      // Set sequence to max ID + 100 to ensure we skip any gaps
      const newSeqValue = maxId + 100;
      await query(`SELECT setval('users_id_seq', $1, false)`, [newSeqValue]);

      res.json({
        message: "User sequence fixed successfully",
        maxId,
        sequenceSetTo: newSeqValue,
        nextId: newSeqValue
      });
    } catch (error) {
      console.error('Error fixing user sequence:', error);
      res.status(500).json({ message: "Failed to fix user sequence" });
    }
  });

  // Admin endpoint to reset user password (temporary - for debugging)
  app.post("/api/admin/reset-password", async (req, res) => {
    try {
      const { username, newPassword } = req.body;

      if (!username || !newPassword) {
        return res.status(400).json({ message: "Username and newPassword are required" });
      }

      const user = await storage.getUserByUsername(username);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Hash the new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // Update the user's password
      await storage.updateUser(user.id, { password: hashedPassword });

      res.json({
        message: "Password reset successfully",
        username: user.username,
        newPassword: newPassword // Only for debugging - remove in production!
      });
    } catch (error) {
      console.error('Error resetting password:', error);
      res.status(500).json({ message: "Failed to reset password" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
