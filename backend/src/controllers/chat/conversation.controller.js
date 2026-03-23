const { v4: uuidv4 } = require("uuid");
const pool = require("../../../db/postgres");

const createConversationController = async (req, res) => {
  const conversationId = uuidv4();
  res.json({ conversationId });
};

const getConversationsController = async (req, res) => {
  const userId = req.user.userId;
  const result = await pool.query(
    `SELECT id, title, preview, is_pinned, pin_order, created_at, updated_at
     FROM conversations
     WHERE user_id = $1
     ORDER BY is_pinned DESC, pin_order DESC, updated_at DESC`,
    [userId]
  );
  res.json(result.rows);
};

const updateTitleController = async (req, res) => {
  const { title } = req.body;
  const userId = req.user.userId;

  const convoCheck = await pool.query(
    "SELECT id FROM conversations WHERE id=$1 AND user_id=$2",
    [req.params.id, userId]
  );

  if (convoCheck.rows.length === 0) {
    return res.status(403).json({ error: "Access denied" });
  }

  await pool.query(
    "UPDATE conversations SET title=$1, updated_at=CURRENT_TIMESTAMP WHERE id=$2",
    [title, req.params.id]
  );

  res.json({ success: true });
};

const pinConversationController = async (req, res) => {
  const { isPinned } = req.body;
  const userId = req.user.userId;

  const convoCheck = await pool.query(
    "SELECT id FROM conversations WHERE id=$1 AND user_id=$2",
    [req.params.id, userId]
  );

  if (convoCheck.rows.length === 0) {
    return res.status(403).json({ error: "Access denied" });
  }

  const timestamp = isPinned ? Date.now() : 0;
  await pool.query(
    "UPDATE conversations SET is_pinned=$1, pin_order=$2, updated_at=CURRENT_TIMESTAMP WHERE id=$3",
    [isPinned, timestamp, req.params.id]
  );

  res.json({ success: true });
};

const deleteConversationController = async (req, res) => {
  const userId = req.user.userId;

  const convoCheck = await pool.query(
    "SELECT id FROM conversations WHERE id=$1 AND user_id=$2",
    [req.params.id, userId]
  );

  if (convoCheck.rows.length === 0) {
    return res.status(403).json({ error: "Access denied" });
  }

  await pool.query(
    `DELETE FROM jira_issues 
     WHERE ba_version_id IN (
       SELECT v.id FROM ba_versions v
       JOIN ba_documents d ON v.ba_document_id = d.id
       WHERE d.conversation_id = $1
     )`,
    [req.params.id]
  );

  await pool.query(
    `DELETE FROM activity_diagrams 
     WHERE ba_version_id IN (
       SELECT v.id FROM ba_versions v
       JOIN ba_documents d ON v.ba_document_id = d.id
       WHERE d.conversation_id = $1
     )`,
    [req.params.id]
  );

  await pool.query(
    `DELETE FROM ba_versions 
     WHERE ba_document_id IN (
       SELECT id FROM ba_documents WHERE conversation_id = $1
     )`,
    [req.params.id]
  );

  await pool.query("DELETE FROM ba_documents WHERE conversation_id = $1", [req.params.id]);
  await pool.query("DELETE FROM messages WHERE conversation_id = $1", [req.params.id]);
  await pool.query("DELETE FROM conversations WHERE id = $1", [req.params.id]);

  res.json({ success: true });
};

const getMessagesController = async (req, res) => {
  const userId = req.user.userId;

  const convoCheck = await pool.query(
    "SELECT id FROM conversations WHERE id=$1 AND user_id=$2",
    [req.params.id, userId]
  );

  if (convoCheck.rows.length === 0) {
    return res.status(403).json({ error: "Access denied" });
  }

  const result = await pool.query(
    `SELECT sender, content
     FROM messages
     WHERE conversation_id=$1
     ORDER BY created_at`,
    [req.params.id]
  );

  res.json(result.rows);
};

module.exports = {
  createConversationController,
  getConversationsController,
  updateTitleController,
  pinConversationController,
  deleteConversationController,
  getMessagesController
};
