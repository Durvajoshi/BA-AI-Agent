import { DataTypes } from "sequelize";
import { centralDB } from "../config/db.js";

const JiraIssue = centralDB.define(
  "JiraIssue",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    ba_version_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    user_story_id: {
      type: DataTypes.TEXT,
    },
    jira_issue_key: {
      type: DataTypes.TEXT,
    },
  },
  {
    tableName: "jira_issues",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: false,
    underscored: true,
  }
);

export default JiraIssue;
