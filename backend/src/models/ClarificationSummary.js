import { DataTypes } from "sequelize";
import { centralDB } from "../config/db.js";

const ClarificationSummary = centralDB.define(
  "ClarificationSummary",
  {
    conversation_id: {
      type: DataTypes.UUID,
      primaryKey: true,
    },
    initial_requirement: {
      type: DataTypes.TEXT,
    },
    clarification_answers: {
      type: DataTypes.TEXT,
    },
  },
  {
    tableName: "clarification_summary",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: false,
    underscored: true,
  }
);

export default ClarificationSummary;
