const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');  // this is used for validation of form data
const UserModel = require('../models/user.model');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const e = require('express');

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
        
        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = await UserModel.create({
            name: name,
            email: email,
            password: hashedPassword
        });

        res.json(newUser);
});

router.get('/login', (req, res) => {
    res.render('login');
});

router.post('/login', async (req, res) => {
    const { name, password } = req.body;
    
    const user = await UserModel.findOne({ name: name });

    if (!user) {
        return res.status(400).json({ message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
        return res.status(400).json({ message: 'Invalid credentials' });
    }
    const token = jwt.sign({ 
        userId: user._id,
        email: user.email,
        username: user.name

    },
        process.env.JWT_SECRET,
    )

    res.cookie('token', token, { httpOnly: true });

    res.json({ message: 'Login successful' });
    

});

router.post('/logout', (req, res) => {
    res.clearCookie('token');
    res.json({ message: 'Logged out successfully' });
});


module.exports = router;