const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');  // this is used for validation of form data

// router.get('/test', (req, res) => {
//     res.send('User test routes');
// });


router.get('/register', (req, res) => {
    res.render('register');
});

router.post('/register', 
    body('email').trim().isEmail(),
    body('password').trim().isLength({ min: 4 }),
    body('name').trim().isLength({ min: 3 }),
    (req, res) => {

        const errors = validationResult(req);
        if (!errors.isEmpty()) {        
            return res.status(400).json({ errors: errors.array(), message: 'Invalid data' });
        }
        res.send(errors)

    console.log(req.body); // You can see the form data in the console by using this 
    res.send('User registered successfully!');
});

module.exports = router;