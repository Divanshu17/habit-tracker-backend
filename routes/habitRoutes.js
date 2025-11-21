const express = require('express');
const router = express.Router();
const habitController = require('../controllers/habitController');

router.post('/', habitController.createHabit);
router.get('/', habitController.getHabits);
router.post('/:id/toggle', habitController.toggleHabit);
router.delete('/:id', habitController.deleteHabit);

module.exports = router;
