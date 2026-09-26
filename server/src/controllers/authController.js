import User from '../models/User.js';
import { signToken } from '../utils/jwt.js';

const generateToken = (user) => {
    return signToken(
        { id: user._id, role: user.role, institutionId: user.institutionId },
        { expiresIn: process.env.JWT_EXPIRES_IN || '30d' },
    );
};

const userResponse = (user) => ({
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    institutionId: user.institutionId,
    customerRef: user.customerRef,
});

// @desc    Register a new user
// @route   POST /api/auth/signup
// @access  Public
export const signupUser = async (req, res) => {
    try {
        const { name, email, password, role = 'citizen', institutionId = null } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ message: 'Please provide all required fields' });
        }
        if (!['citizen', 'analyst'].includes(role)) {
            return res.status(400).json({ message: 'Role must be citizen or analyst' });
        }
        const normalizedInstitutionId = role === 'analyst' ? Number(institutionId) : null;
        if (role === 'analyst' && (!Number.isInteger(normalizedInstitutionId) || normalizedInstitutionId < 0 || normalizedInstitutionId > 4)) {
            return res.status(400).json({ message: 'Bank employees must select an institution from 0 to 4' });
        }

        const userExists = await User.findOne({ email });

        if (userExists) {
            return res.status(400).json({ message: 'User already exists' });
        }

        const user = await User.create({
            name,
            email,
            password,
            role,
            institutionId: normalizedInstitutionId,
        });

        if (user) {
            res.status(201).json({
                user: userResponse(user),
                token: generateToken(user),
            });
        } else {
            res.status(400).json({ message: 'Invalid user data received' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Auth user & get token
// @route   POST /api/auth/login
// @access  Public
export const loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required' });
        }

        const user = await User.findOne({ email });

        if (user && (await user.matchPassword(password))) {
            res.json({
                user: userResponse(user),
                token: generateToken(user),
            });
        } else {
            // Return same generic error message for invalid email or password
            res.status(401).json({ message: 'Invalid email or password' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get user profile (Protected example route)
// @route   GET /api/auth/profile
// @access  Private
export const getUserProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);

        if (user) {
            res.json(userResponse(user));
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
