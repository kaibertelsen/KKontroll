
import { postNEON } from './neon';

/**
 * Logs an activity to the database (logs table).
 * Fire-and-forget: does not block execution.
 */
export const logActivity = (
    userId: number, 
    action: string, 
    entity?: string, 
    entityId?: number, 
    details?: string
) => {
    // We don't await this because logging shouldn't slow down the UI
    postNEON({
        table: 'logs',
        data: {
            user_id: userId,
            action,
            entity,
            entity_id: entityId,
            details: details ? details.substring(0, 1000) : undefined
        },
        public: false // Requires auth headers
    }).catch(err => {
        console.warn("Failed to log activity:", err);
    });
};
