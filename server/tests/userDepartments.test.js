const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

const User = require('../models/User.model');

const TEST_SECRET = 'test-secret';
process.env.JWT_SECRET = TEST_SECRET;

/** Chainable query stub: every method returns the chain, await resolves to value. */
const makeQuery = (value) => {
  const query = {};
  query.select = jest.fn(() => query);
  query.populate = jest.fn(() => query);
  query.then = (onFulfilled, onRejected) => Promise.resolve(value).then(onFulfilled, onRejected);
  return query;
};

describe('User multi-department support', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('schema invariant', () => {
    const base = {
      name: 'Test Faculty',
      email: 'faculty@example.com',
      password: 'secret123',
      designation: 'faculty',
    };

    test('departments defaults to an empty array when no department is set', async () => {
      const user = new User(base);
      await user.validate();
      expect(user.departments).toEqual([]);
    });

    test('primary department is added to departments when omitted', async () => {
      const primary = new mongoose.Types.ObjectId();
      const user = new User({ ...base, department: primary });
      await user.validate();

      expect(user.departments.map((id) => id.toString())).toEqual([primary.toString()]);
    });

    test('supplementary departments are preserved and primary is appended', async () => {
      const primary = new mongoose.Types.ObjectId();
      const secondary = new mongoose.Types.ObjectId();

      const user = new User({
        ...base,
        department: primary,
        departments: [secondary],
      });
      await user.validate();

      expect(user.departments.map((id) => id.toString())).toEqual([
        secondary.toString(),
        primary.toString(),
      ]);
    });

    test('duplicate department ids are removed', async () => {
      const primary = new mongoose.Types.ObjectId();
      const secondary = new mongoose.Types.ObjectId();

      const user = new User({
        ...base,
        department: primary,
        departments: [primary, secondary, primary],
      });
      await user.validate();

      expect(user.departments.map((id) => id.toString())).toEqual([
        primary.toString(),
        secondary.toString(),
      ]);
    });

    test('toJSON never exposes the password but includes departments', async () => {
      const primary = new mongoose.Types.ObjectId();
      const user = new User({ ...base, department: primary });
      await user.validate();

      const json = user.toJSON();
      expect(json.password).toBeUndefined();
      expect(json.departments.map((id) => id.toString())).toEqual([primary.toString()]);
    });
  });

  describe('authentication', () => {
    test('login populates department and departments', async () => {
      const authService = require('../services/auth.service');
      const primary = new mongoose.Types.ObjectId();
      const secondary = new mongoose.Types.ObjectId();

      const user = {
        _id: new mongoose.Types.ObjectId(),
        name: 'Test Faculty',
        email: 'faculty@example.com',
        designation: 'faculty',
        isActive: true,
        department: { _id: primary, name: 'Computer Science', code: 'CS' },
        departments: [{ _id: primary, name: 'Computer Science', code: 'CS' }, { _id: secondary, name: 'AI', code: 'AI' }],
        comparePassword: jest.fn().mockResolvedValue(true),
      };

      const query = makeQuery(user);
      jest.spyOn(User, 'findOne').mockReturnValue(query);

      const result = await authService.login({ email: 'FACULTY@example.com', password: 'secret123' });

      expect(query.populate).toHaveBeenCalledWith('department', 'name code');
      expect(query.populate).toHaveBeenCalledWith('departments', 'name code');
      expect(result.user.departments).toHaveLength(2);
      expect(result.token).toEqual(expect.any(String));
    });

    test('JWT payload contains only id and designation', async () => {
      const authService = require('../services/auth.service');
      const userId = new mongoose.Types.ObjectId();

      const user = {
        _id: userId,
        name: 'Test Faculty',
        email: 'faculty@example.com',
        designation: 'faculty',
        isActive: true,
        department: null,
        departments: [],
        comparePassword: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(User, 'findOne').mockReturnValue(makeQuery(user));

      const { token } = await authService.login({ email: 'faculty@example.com', password: 'secret123' });
      const decoded = jwt.decode(token);

      expect(decoded.id).toBe(userId.toString());
      expect(decoded.designation).toBe('faculty');
      expect(decoded.department).toBeUndefined();
      expect(decoded.departments).toBeUndefined();
    });
  });

  describe('verifyToken middleware', () => {
    const mockResponse = () => {
      const res = {};
      res.status = jest.fn().mockReturnValue(res);
      res.json = jest.fn().mockReturnValue(res);
      return res;
    };

    test('populates both department fields and attaches the user', async () => {
      const { verifyToken } = require('../middlewares/auth.middleware');

      const user = {
        _id: new mongoose.Types.ObjectId(),
        isActive: true,
        department: { _id: new mongoose.Types.ObjectId(), name: 'CS', code: 'CS' },
        departments: [{ _id: new mongoose.Types.ObjectId(), name: 'AI', code: 'AI' }],
      };

      const query = makeQuery(user);
      jest.spyOn(User, 'findById').mockReturnValue(query);

      const token = jwt.sign({ id: user._id.toString() }, TEST_SECRET);
      const req = { headers: { authorization: `Bearer ${token}` } };
      const res = mockResponse();
      const next = jest.fn();

      await verifyToken(req, res, next);

      expect(query.populate).toHaveBeenCalledWith('department', 'name code');
      expect(query.populate).toHaveBeenCalledWith('departments', 'name code');
      expect(req.user).toBe(user);
      expect(next).toHaveBeenCalled();
    });
  });
});