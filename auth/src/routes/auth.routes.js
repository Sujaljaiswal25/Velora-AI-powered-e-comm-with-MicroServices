const express = require('express');
const validators = require('../middlewares/validator.middleware');
const authController = require("../controllers/auth.controller");
const authMiddleware = require('../middlewares/auth.middleware');




const router = express.Router();

router.post('/register', validators.registerUserValidations, authController.registerUser);

router.post('/login', validators.loginUserValidations, authController.loginUser);

router.get('/me', authMiddleware.authMiddleware, authController.getCurrentUser);

router.get("/logout", authController.logoutUser);

router.get('/users/me/addresses', authMiddleware.authMiddleware, authController.getUserAddresses);

router.post("/users/me/addresses", validators.addUserAddressValidations, authMiddleware.authMiddleware, authController.addUserAddress)

router.delete("/users/me/addresses/:addressId", authMiddleware.authMiddleware, authController.deleteUserAddress)

module.exports = router;



