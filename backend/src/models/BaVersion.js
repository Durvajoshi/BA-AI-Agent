import { DataTypes } from "sequelize";
import { centralDB } from "../config/db.js";

const BaVersion = centralDB.define(
  "BaVersion",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    ba_document_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    version_number: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    ba_output: {
      type: DataTypes.JSONB,
    },
    change_summary: {
      type: DataTypes.TEXT,
    },
    diff: {
      type: DataTypes.JSONB,
    },
    prd_markdown: {
      type: DataTypes.TEXT,
    },
    brd_markdown: {
      type: DataTypes.TEXT,
    },
  },
  {
    tableName: "ba_versions",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: false,
    underscored: true,
  }
);

export default BaVersion;
