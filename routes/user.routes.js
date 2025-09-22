const express = require('express');
const router = express.Router();

// router.get('/test', (req, res) => {
//     res.send('User test routes');
// });


router.get('/register', (req, res) => {
    res.render('register');
});

module.exports = router;