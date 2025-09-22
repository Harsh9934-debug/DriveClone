const express = require('express');
const userRoutes = require('./routes/user.routes');
const dotenv = require('dotenv');    // this is used for environment variables used in all the files like db connection string
dotenv.config(); // this is used in the section to load the environment variables from the .env file
const connectToDB = require('./config/db');  // rendering the db connection function
connectToDB(); // this is the section used to connect to the database


const app = express();


app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(express.json());


app.use('/user', userRoutes); 

app.listen(3000, () => {
    console.log(`Server is running on port 3000`);
});

module.exports = app; 