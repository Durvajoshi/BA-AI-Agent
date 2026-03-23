import { DataTypes } from "sequelize";
import { centralDB } from "../config/db.js";

const Conversation = centralDB.define(
  "Conversation",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    title: {
      type: DataTypes.STRING,
    },
    preview: {
      type: DataTypes.TEXT,
    },
    clarification_done: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    jira_exported: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    jira_epic_key: {
      type: DataTypes.TEXT,
    },
    is_pinned: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    pin_order: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
  },
  {
    tableName: "conversations",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    underscored: true,
  }
);

export default Conversation;
