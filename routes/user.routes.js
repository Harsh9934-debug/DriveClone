const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');  // this is used for validation of form data
const UserModel = require('../models/user.model');


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
    async (req, res) => {

        const errors = validationResult(req);

        if (!errors.isEmpty()) {        
            return res.status(400).json({ errors: errors.array(), message: 'Invalid data' });
        }
        const { name, email, password } = req.body;
        
        const newUser = await UserModel.create({
            name: name,
            email: email,
            password: password
        });

        res.json(newUser);
});

module.exports = router;