import { DataTypes } from "sequelize";
import { centralDB } from "../config/db.js";

const ActivityDiagram = centralDB.define(
  "ActivityDiagram",
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
    diagram_definition: {
      type: DataTypes.TEXT,
    },
    gherkin_definition: {
      type: DataTypes.TEXT,
    },
    schema_definition: {
      type: DataTypes.TEXT,
    },
    prototype_definition: {
      type: DataTypes.TEXT,
    },
    architecture_definition: {
      type: DataTypes.TEXT,
    },
    competitor_analysis: {
      type: DataTypes.TEXT,
    },
    risk_analysis: {
      type: DataTypes.TEXT,
    },
    project_estimate: {
      type: DataTypes.TEXT,
    },
  },
  {
    tableName: "activity_diagrams",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: false,
    underscored: true,
  }
);

export default ActivityDiagram;
