const pool = require("./postgres");

async function runMigrations() {
  try {
    console.log("Starting database migrations...");

    // Add title column to conversations if it doesn't exist
    try {
      await pool.query(`
        ALTER TABLE conversations
        ADD COLUMN IF NOT EXISTS title VARCHAR(255);
      `);
      console.log("✓ title column added to conversations (if needed)");
    } catch (err) {
      console.error("Warning: Could not add title column:", err.message);
    }

    // Add preview column to conversations if it doesn't exist
    try {
      await pool.query(`
        ALTER TABLE conversations
        ADD COLUMN IF NOT EXISTS preview TEXT;
      `);
      console.log("✓ preview column added to conversations (if needed)");
    } catch (err) {
      console.error("Warning: Could not add preview column:", err.message);
    }

    // Add clarification_done column to conversations if it doesn't exist
    try {
      await pool.query(`
        ALTER TABLE conversations
        ADD COLUMN IF NOT EXISTS clarification_done BOOLEAN DEFAULT false;
      `);
      console.log("✓ clarification_done column added to conversations (if needed)");
    } catch (err) {
      console.error("Warning: Could not add clarification_done column:", err.message);
    }

    // Add updated_at column to conversations if it doesn't exist
    try {
      await pool.query(`
        ALTER TABLE conversations
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
      `);
      console.log("✓ updated_at column added to conversations (if needed)");
    } catch (err) {
      console.error("Warning: Could not add updated_at column:", err.message);
    }

    // Add email verification columns to users table
    try {
      await pool.query(`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false;
      `);
      console.log("✓ email_verified column added to users (if needed)");
    } catch (err) {
      console.error("Warning: Could not add email_verified column:", err.message);
    }

    // Add email_verified_at column to users table
    try {
      await pool.query(`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMP;
      `);
      console.log("✓ email_verified_at column added to users (if needed)");
    } catch (err) {
      console.error("Warning: Could not add email_verified_at column:", err.message);
    }

    // Create OTP codes table if it doesn't exist
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS otp_codes (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          email VARCHAR(255) NOT NULL,
          code VARCHAR(6) NOT NULL,
          expires_at TIMESTAMP NOT NULL,
          is_verified BOOLEAN DEFAULT false,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      console.log("✓ otp_codes table created (if needed)");
    } catch (err) {
      console.error("Warning: Could not create otp_codes table:", err.message);
    }

    // Create index on otp_codes email column
    try {
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_otp_email ON otp_codes(email);
      `);
      console.log("✓ index on otp_codes.email created (if needed)");
    } catch (err) {
      console.error("Warning: Could not create index on otp_codes.email:", err.message);
    }

    // Add PRD and BRD markdown cache columns to ba_versions
    try {
      await pool.query(`
        ALTER TABLE ba_versions
        ADD COLUMN IF NOT EXISTS prd_markdown TEXT,
        ADD COLUMN IF NOT EXISTS brd_markdown TEXT;
      `);
      console.log("✓ prd_markdown and brd_markdown columns added to ba_versions (if needed)");
    } catch (err) {
      console.error("Warning: Could not add PRD/BRD columns:", err.message);
    }

    // Add prototype_definition column to activity_diagrams
    try {
      await pool.query(`
        ALTER TABLE activity_diagrams
        ADD COLUMN IF NOT EXISTS prototype_definition TEXT;
      `);
      console.log("✓ prototype_definition column added to activity_diagrams (if needed)");
    } catch (err) {
      console.error("Warning: Could not add prototype_definition column:", err.message);
    }

    // Add new analysis columns to activity_diagrams
    try {
      await pool.query(`
        ALTER TABLE activity_diagrams
        ADD COLUMN IF NOT EXISTS architecture_definition TEXT,
        ADD COLUMN IF NOT EXISTS competitor_analysis TEXT,
        ADD COLUMN IF NOT EXISTS risk_analysis TEXT,
        ADD COLUMN IF NOT EXISTS project_estimate TEXT;
      `);
      console.log("✓ architecture, competitor, risk, estimate columns added to activity_diagrams (if needed)");
    } catch (err) {
      console.error("Warning: Could not add new analysis columns:", err.message);
    }

    // Add openrouter_api_key column to users table
    try {
      await pool.query(`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS openrouter_api_key TEXT;
      `);
      console.log("✓ openrouter_api_key column added to users (if needed)");
    } catch (err) {
      console.error("Warning: Could not add openrouter_api_key column:", err.message);
    }

    // Add free_messages_used column to users table
    try {
      await pool.query(`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS free_messages_used INTEGER DEFAULT 0;
      `);
      console.log("✓ free_messages_used column added to users (if needed)");
    } catch (err) {
      console.error("Warning: Could not add free_messages_used column:", err.message);
    }

    console.log("Database migrations completed successfully");
    return true;
  } catch (err) {
    console.error("Migration error:", err.message);
    throw err;
  }
}

module.exports = runMigrations;
