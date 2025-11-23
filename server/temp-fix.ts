// This file contains all the necessary fixes for the routes
// Operator should have access to all data like admin, no Users page visibility
// Admin should have edit/delete capabilities for payment records and entries

// Fix for /api/entries endpoint
export const entriesGetFix = `
  app.get("/api/entries", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      let entries;
      
      if (user.role === "admin" || user.role === "operator") {
        entries = await storage.getEntries();
      } else {
        entries = await storage.getUserEntries(user.id);
      }
      
      res.json(entries);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch entries" });
    }
  });
`;

// Fix for the dashboard endpoint
export const dashboardGetFix = `
  app.get("/api/dashboard", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      
      // Dashboard should be accessible to admins and operators
      if (user.role === "admin" || user.role === "operator") {
        // Get all entries for stats
        const entries = await storage.getEntries();
        
        // Calculate summary stats
        const summary = {
          totalAmount: 0,
          receivedAmount: 0,
          pendingAmount: 0,
          pendingEntries: 0,
          partialEntries: 0,
          completedEntries: 0
        };
        
        const recentActivity = [];
        
        // Only keep 5 most recent entries for the recent activity feed
        entries.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        
        for (const entry of entries) {
          // Update summary stats
          summary.totalAmount += entry.totalAmount;
          
          const receivedAmount = entry.payments.reduce((total, payment) => total + payment.amount, 0);
          summary.receivedAmount += receivedAmount;
          
          const pendingAmount = entry.totalAmount - receivedAmount;
          summary.pendingAmount += pendingAmount;
          
          // Count entries by status
          if (entry.status === "pending") {
            summary.pendingEntries++;
          } else if (entry.status === "partial") {
            summary.partialEntries++;
          } else if (entry.status === "full") {
            summary.completedEntries++;
          }
          
          // Add to recent activity if we have less than 5 entries
          if (recentActivity.length < 5) {
            recentActivity.push(entry);
          }
        }
        
        res.json({
          summary,
          recentActivity
        });
      } else {
        // For regular users, only show their own entries
        const entries = await storage.getUserEntries(user.id);
        
        // Calculate summary stats for just this user
        const summary = {
          totalAmount: 0,
          receivedAmount: 0,
          pendingAmount: 0,
          pendingEntries: 0,
          partialEntries: 0,
          completedEntries: 0
        };
        
        // Sort by updated date descending
        entries.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        
        for (const entry of entries) {
          // Update summary stats
          summary.totalAmount += entry.totalAmount;
          
          const receivedAmount = entry.payments.reduce((total, payment) => total + payment.amount, 0);
          summary.receivedAmount += receivedAmount;
          
          const pendingAmount = entry.totalAmount - receivedAmount;
          summary.pendingAmount += pendingAmount;
          
          // Count entries by status
          if (entry.status === "pending") {
            summary.pendingEntries++;
          } else if (entry.status === "partial") {
            summary.partialEntries++;
          } else if (entry.status === "full") {
            summary.completedEntries++;
          }
        }
        
        // Only send back up to 5 entries for recent activity
        const recentActivity = entries.slice(0, 5);
        
        res.json({
          summary,
          recentActivity
        });
      }
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch dashboard data" });
    }
  });
`;