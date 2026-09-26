const express = require("express");
const validateToken = require("../middleware/authMiddleware");
const controller = require("../controllers/personalFlashcardController");

const router = express.Router();

router.use(validateToken);

router.get("/decks", controller.listDecks);
router.post("/decks", controller.createDeck);
router.put("/decks/:deckId", controller.updateDeck);
router.delete("/decks/:deckId", controller.deleteDeck);
router.get("/decks/:deckId/cards", controller.listCards);
router.post("/decks/:deckId/cards", controller.createCard);
router.put("/decks/:deckId/cards/:cardId", controller.updateCard);
router.delete("/decks/:deckId/cards/:cardId", controller.deleteCard);

module.exports = router;
