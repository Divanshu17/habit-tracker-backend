const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

const habitRoutes = require('./routes/habitRoutes');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/habits', habitRoutes);

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;

mongoose.connect(MONGO_URI, {
	useNewUrlParser: true,
	useUnifiedTopology: true,
})
	.then(() => {
		console.log('Connected to MongoDB');
		app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
	})
	.catch(err => {
		console.error('Mongo connection error:', err);
		process.exit(1);
	});
