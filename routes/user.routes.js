const express = require('express');
const router = express.Router();

// router.get('/test', (req, res) => {
//     res.send('User test routes');
// });


router.get('/register', (req, res) => {
    res.render('register');
});

router.post('/register', (req, res) => {
    console.log(req.body); // You can see the form data in the console by using this 
    res.send('User registered successfully!');
});

module.exports = router;