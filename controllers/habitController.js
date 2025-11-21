const Habit = require('../models/Habit');

// Helper: format a Date to YYYY-MM-DD (UTC)
function formatDateUTC(date) {
	const y = date.getUTCFullYear();
	const m = String(date.getUTCMonth() + 1).padStart(2, '0');
	const d = String(date.getUTCDate()).padStart(2, '0');
	return `${y}-${m}-${d}`;
}

// Helper: convert a local Date (JS Date) -> UTC midnight for that local date
function localDateToUTCmidnight(date = new Date()) {
	// Interpret date's local YMD then create UTC midnight representing that local date
	const year = date.getFullYear();
	const month = date.getMonth();
	const day = date.getDate();
	return new Date(Date.UTC(year, month, day));
}

// Parse stored history date to YYYY-MM-DD for comparison
function historyDateKey(histDate) {
	return formatDateUTC(new Date(histDate));
}

exports.createHabit = async (req, res) => {
	try {
		const { name } = req.body;
		if (!name) return res.status(400).json({ message: 'Name is required' });

		const habit = new Habit({
			name,
			createdAt: new Date(),
			currentStreak: 0,
			longestStreak: 0,
			lastCompletedDate: null,
			history: []
		});

		await habit.save();
		return res.status(201).json(habit);
	} catch (err) {
		console.error(err);
		return res.status(500).json({ message: 'Server error creating habit' });
	}
};

exports.getHabits = async (req, res) => {
	try {
		const { sort } = req.query;
		let sortObj = {};
		if (sort === 'name') sortObj = { name: 1 };
		else if (sort === 'currentStreak') sortObj = { currentStreak: -1 };
		else if (sort === 'longestStreak') sortObj = { longestStreak: -1 };

		const habits = await Habit.find().sort(sortObj).lean();

		// Normalize history dates to YYYY-MM-DD strings for frontend convenience
		const normalized = habits.map(h => ({
			...h,
			history: h.history.map(entry => ({
				date: formatDateUTC(new Date(entry.date)),
				completed: entry.completed
			})),
			createdAt: formatDateUTC(new Date(h.createdAt)),
			lastCompletedDate: h.lastCompletedDate ? formatDateUTC(new Date(h.lastCompletedDate)) : null,
			_id: h._id.toString()
		}));

		return res.json(normalized);
	} catch (err) {
		console.error(err);
		return res.status(500).json({ message: 'Server error fetching habits' });
	}
};

exports.toggleHabit = async (req, res) => {
	try {
		const { id } = req.params;

		const habit = await Habit.findById(id);
		if (!habit) return res.status(404).json({ message: 'Habit not found' });

		// Determine "today" in client's local date converted to UTC midnight
		const todayUTCmid = localDateToUTCmidnight(new Date());
		const todayKey = formatDateUTC(todayUTCmid);

		// Build a map from dateKey -> history entry
		const historyMap = new Map();
		for (const h of habit.history) {
			const key = formatDateUTC(new Date(h.date));
			historyMap.set(key, h);
		}

		const existing = historyMap.get(todayKey);

		if (existing) {
			// Toggle existing entry
			existing.completed = !existing.completed;
			// If toggled off, maybe update lastCompletedDate/currentStreak later
		} else {
			// Add a new completed entry for today
			habit.history.push({ date: todayUTCmid, completed: true });
		}

		// Recompute streaks
		// Build set of completed date keys
		const completedSet = new Set();
		for (const h of habit.history) {
			const k = formatDateUTC(new Date(h.date));
			if (h.completed) completedSet.add(k);
		}

		// Compute current streak: start from todayKey, check consecutive days backward
		let currentStreak = 0;
		let cursor = new Date(todayUTCmid);
		while (true) {
			const key = formatDateUTC(cursor);
			if (completedSet.has(key)) {
				currentStreak++;
				// move one day back
				cursor = new Date(cursor.getTime() - 24 * 60 * 60 * 1000);
			} else break;
		}

		// Compute longest streak by scanning sorted completed dates
		const completedDates = Array.from(completedSet).sort(); // ascending YYYY-MM-DD
		let longest = 0;
		let run = 0;
		let prev = null;
		for (const dstr of completedDates) {
			if (!prev) {
				run = 1;
			} else {
				// parse to Date (UTC)
				const cur = new Date(dstr + 'T00:00:00Z');
				const prevDate = new Date(prev + 'T00:00:00Z');
				const diffDays = Math.round((cur - prevDate) / (24 * 60 * 60 * 1000));
				if (diffDays === 1) run++;
				else run = 1;
			}
			if (run > longest) longest = run;
			prev = dstr;
		}

		// Update fields
		habit.currentStreak = currentStreak;
		habit.longestStreak = longest;
		habit.lastCompletedDate = habit.history.length ? (() => {
			// Latest completed date
			const completed = habit.history.filter(h => h.completed);
			if (completed.length === 0) return null;
			const latest = completed.reduce((a, b) => (new Date(a.date) > new Date(b.date) ? a : b));
			return localDateToUTCmidnight(new Date(latest.date));
		})() : null;

		await habit.save();

		// Return normalized habit
		const h = habit.toObject();
		h.history = h.history.map(entry => ({ date: formatDateUTC(new Date(entry.date)), completed: entry.completed }));
		h.createdAt = formatDateUTC(new Date(h.createdAt));
		h.lastCompletedDate = h.lastCompletedDate ? formatDateUTC(new Date(h.lastCompletedDate)) : null;
		h._id = h._id.toString();

		return res.json(h);
	} catch (err) {
		console.error(err);
		return res.status(500).json({ message: 'Server error toggling habit' });
	}
};

exports.deleteHabit = async (req, res) => {
	try {
		const { id } = req.params;
		const deleted = await Habit.findByIdAndDelete(id);
		if (!deleted) return res.status(404).json({ message: 'Habit not found' });
		return res.json({ message: 'Deleted' });
	} catch (err) {
		console.error(err);
		return res.status(500).json({ message: 'Server error deleting habit' });
	}
};
