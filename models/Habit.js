const mongoose = require('mongoose');

const HistorySchema = new mongoose.Schema({
	date: { type: Date, required: true }, // stored as UTC midnight
	completed: { type: Boolean, default: false }
}, { _id: false });

const HabitSchema = new mongoose.Schema({
	name: { type: String, required: true },
	createdAt: { type: Date, default: () => new Date() },
	currentStreak: { type: Number, default: 0 },
	longestStreak: { type: Number, default: 0 },
	lastCompletedDate: { type: Date, default: null }, // UTC date
	history: { type: [HistorySchema], default: [] }
});

module.exports = mongoose.model('Habit', HabitSchema);
