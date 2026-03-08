/**
 * SureOdds - 인증 라우트
 * /api/auth
 */
const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');

// GET /api/auth/me - 현재 로그인한 사용자 프로필 조회
router.get('/me', requireAuth, async (req, res) => {
  try {
    res.json({
      success: true,
      data: req.user.profile,
    });
  } catch (err) {
    console.error('Get profile error:', err);
    res.status(500).json({
      success: false,
      error: '프로필 조회에 실패했습니다.',
    });
  }
});

module.exports = router;
