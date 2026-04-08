require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const app = express();

app.use(express.json());
app.use(cors());
app.use(helmet());

app.listen(3000, () => console.log('Server started on port 3000'));