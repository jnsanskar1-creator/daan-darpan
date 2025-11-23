import { User, Entry, PaymentRecord, PaymentStatus } from "@shared/schema";

// Notification service to send notifications to users
export class NotificationService {
  /**
   * Send mobile notification when a new entry is created for a user
   * @param user The user to notify
   * @param entry The entry that was created
   */
  static async notifyEntryCreated(user: User, entry: Entry): Promise<void> {
    if (!user.mobile) return;
    
    try {
      console.log(`[MOBILE NOTIFICATION] New entry created for ${user.name} (${user.mobile})`);
      console.log(`Entry: ${entry.description} - ₹${entry.totalAmount}`);
      
      // In a real application, you would integrate with a mobile notification service
      // such as Twilio, Firebase Cloud Messaging, or a custom mobile app API
      
      // Example implementation for future integration:
      /*
      const message = {
        to: user.mobile,
        body: `New entry added: ${entry.description} for ₹${entry.totalAmount}`
      };
      await mobileNotificationProvider.send(message);
      */
    } catch (error) {
      console.error("Failed to send mobile notification:", error);
    }
  }

  /**
   * Send mobile notification when a payment is recorded for an entry
   * @param user The user to notify
   * @param entry The entry for which payment was recorded
   * @param payment The payment that was recorded
   */
  static async notifyPaymentRecorded(user: User, entry: Entry, payment: PaymentRecord): Promise<void> {
    if (!user.mobile) return;
    
    try {
      console.log(`[MOBILE NOTIFICATION] Payment recorded for ${user.name} (${user.mobile})`);
      console.log(`Payment: ₹${payment.amount} for ${entry.description} via ${payment.mode}`);
      
      // In a real application, you would integrate with a mobile notification service
      
      // Example implementation for future integration:
      /*
      const message = {
        to: user.mobile,
        body: `Payment of ₹${payment.amount} recorded for ${entry.description} via ${payment.mode}`
      };
      await mobileNotificationProvider.send(message);
      */
    } catch (error) {
      console.error("Failed to send mobile notification:", error);
    }
  }
  
  /**
   * Send mobile notification when payment status changes
   * @param user The user to notify
   * @param entry The entry for which status was updated
   * @param oldStatus Previous payment status
   * @param newStatus New payment status
   */
  static async notifyPaymentStatusChanged(
    user: User, 
    entry: Entry, 
    oldStatus: string, 
    newStatus: string
  ): Promise<void> {
    if (!user.mobile) return;
    
    try {
      console.log(`[MOBILE NOTIFICATION] Payment status changed for ${user.name} (${user.mobile})`);
      console.log(`Status change: ${oldStatus} → ${newStatus} for ${entry.description}`);
      
      // Generate a friendly status message
      let statusMessage = "";
      
      if (newStatus === PaymentStatus.PARTIAL) {
        statusMessage = "Partial payment received";
      } else if (newStatus === PaymentStatus.FULL) {
        statusMessage = "Payment completed in full";
      }
      
      // In a real application, you would integrate with a mobile notification service
      
      // Example implementation for future integration:
      /*
      const message = {
        to: user.mobile,
        body: `${statusMessage} for ${entry.description}. Updated amount received: ₹${entry.receivedAmount}`
      };
      await mobileNotificationProvider.send(message);
      */
    } catch (error) {
      console.error("Failed to send mobile notification:", error);
    }
  }
}