import { DataTypes } from "sequelize";
import { centralDB } from "../config/db.js";

const User = centralDB.define(
  "User",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    password_hash: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    full_name: {
      type: DataTypes.STRING,
    },
    jira_base_url: {
      type: DataTypes.STRING,
    },
    jira_email: {
      type: DataTypes.STRING,
    },
    jira_api_token: {
      type: DataTypes.STRING,
    },
    jira_lead_account_id: {
      type: DataTypes.STRING,
    },
    token_version: {
      type: DataTypes.INTEGER,
    },
    email_verified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    email_verified_at: {
      type: DataTypes.DATE,
    },
    openrouter_api_key: {
      type: DataTypes.TEXT,
    },
    free_messages_used: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
  },
  {
    tableName: "users",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    underscored: true,
  }
);

export default User;
