/**
 * SureOdds - 텔레그램 연동 라우트
 * 웹훅 수신 + 유저별 연동/해제 API
 */
const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const supabase = require('../config/supabase');
const { requireAuth } = require('../middleware/auth');
const { getBot } = require('../services/telegramBot');
const { createServiceLogger } = require('../config/logger');

const log = createServiceLogger('Telegram');

const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET || 'default_secret';
const TOKEN_TTL_MS = 15 * 60 * 1000; // 15분

// ─── POST /webhook/:secret — 텔레그램 서버에서 수신 (인증 없음) ───
router.post(`/webhook/${WEBHOOK_SECRET}`, async (req, res) => {
  try {
    const update = req.body;
    const message = update?.message;

    if (!message || !message.text) {
      return res.sendStatus(200);
    }

    const chatId = String(message.chat.id);
    const text = message.text.trim();

    // /start <token> 처리
    if (text.startsWith('/start ')) {
      const token = text.replace('/start ', '').trim();

      if (!token || token.length < 16) {
        await sendBotMessage(chatId, '❌ 유효하지 않은 인증 토큰입니다.');
        return res.sendStatus(200);
      }

      // 토큰으로 프로필 조회
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('id, display_name, telegram_token_expires')
        .eq('telegram_link_token', token)
        .single();

      if (error || !profile) {
        await sendBotMessage(chatId, '❌ 인증 토큰을 찾을 수 없습니다. SureOdds에서 다시 연동해주세요.');
        return res.sendStatus(200);
      }

      // 만료 확인
      if (profile.telegram_token_expires && new Date(profile.telegram_token_expires) < new Date()) {
        await sendBotMessage(chatId, '⏰ 인증 토큰이 만료되었습니다. SureOdds에서 다시 연동해주세요.');
        return res.sendStatus(200);
      }

      // chat_id 저장 + 토큰 초기화
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          telegram_chat_id: chatId,
          telegram_linked_at: new Date().toISOString(),
          telegram_link_token: null,
          telegram_token_expires: null,
        })
        .eq('id', profile.id);

      if (updateError) {
        log.error('Failed to link telegram', { error: updateError.message });
        await sendBotMessage(chatId, '❌ 연동 처리 중 오류가 발생했습니다.');
        return res.sendStatus(200);
      }

      const name = profile.display_name || '회원';
      await sendBotMessage(chatId, `✅ ${name}님, SureOdds 텔레그램 연동이 완료되었습니다!\n\n양방 기회가 감지되면 이 채팅으로 알림을 보내드립니다.`);
      log.info(`Telegram linked: user=${profile.id}, chatId=${chatId}`);

    } else if (text === '/start') {
      await sendBotMessage(chatId, '👋 SureOdds 알림봇입니다.\n\nSureOdds 웹사이트에서 "텔레그램 연동" 버튼을 클릭하세요.');

    } else if (text === '/stop' || text === '/unlink') {
      // 연동 해제
      const { data, error } = await supabase
        .from('profiles')
        .update({
          telegram_chat_id: null,
          telegram_linked_at: null,
        })
        .eq('telegram_chat_id', chatId)
        .select('id')
        .single();

      if (data) {
        await sendBotMessage(chatId, '🔓 텔레그램 연동이 해제되었습니다. 더 이상 알림을 받지 않습니다.');
        log.info(`Telegram unlinked via bot: chatId=${chatId}`);
      } else {
        await sendBotMessage(chatId, '연동된 계정을 찾을 수 없습니다.');
      }

    } else if (text === '/status') {
      const { data } = await supabase
        .from('profiles')
        .select('display_name, telegram_linked_at')
        .eq('telegram_chat_id', chatId)
        .single();

      if (data) {
        const linkedDate = new Date(data.telegram_linked_at).toLocaleDateString('ko-KR');
        await sendBotMessage(chatId, `✅ 연동 상태: ${data.display_name || '회원'}\n연동일: ${linkedDate}`);
      } else {
        await sendBotMessage(chatId, '❌ 연동된 계정이 없습니다.');
      }
    }

    res.sendStatus(200);
  } catch (err) {
    log.error('Webhook error', { error: err.message });
    res.sendStatus(200); // 항상 200 반환 (텔레그램 재시도 방지)
  }
});

// ─── POST /link — 연동 토큰 생성 (인증 필요) ───
router.post('/link', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const token = crypto.randomBytes(16).toString('hex'); // 32자
    const expires = new Date(Date.now() + TOKEN_TTL_MS).toISOString();

    const { error } = await supabase
      .from('profiles')
      .update({
        telegram_link_token: token,
        telegram_token_expires: expires,
      })
      .eq('id', userId);

    if (error) {
      return res.status(500).json({ success: false, error: '토큰 생성 실패' });
    }

    // 봇 username 조회
    const botUsername = await getBotUsername();
    const link = `https://t.me/${botUsername}?start=${token}`;

    res.json({
      success: true,
      link,
      expiresAt: expires,
    });
  } catch (err) {
    log.error('Link generation error', { error: err.message });
    res.status(500).json({ success: false, error: '서버 오류' });
  }
});

// ─── DELETE /link — 연동 해제 (인증 필요) ───
router.delete('/link', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;

    const { error } = await supabase
      .from('profiles')
      .update({
        telegram_chat_id: null,
        telegram_linked_at: null,
        telegram_link_token: null,
        telegram_token_expires: null,
      })
      .eq('id', userId);

    if (error) {
      return res.status(500).json({ success: false, error: '연동 해제 실패' });
    }

    res.json({ success: true });
  } catch (err) {
    log.error('Unlink error', { error: err.message });
    res.status(500).json({ success: false, error: '서버 오류' });
  }
});

// ─── GET /status — 연동 상태 조회 (인증 필요) ───
router.get('/status', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;

    const { data: profile } = await supabase
      .from('profiles')
      .select('telegram_chat_id, telegram_linked_at')
      .eq('id', userId)
      .single();

    res.json({
      success: true,
      linked: !!profile?.telegram_chat_id,
      linkedAt: profile?.telegram_linked_at || null,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: '서버 오류' });
  }
});

// ─── Helpers ───

let cachedBotUsername = null;

async function getBotUsername() {
  if (cachedBotUsername) return cachedBotUsername;
  try {
    const b = getBot();
    if (b) {
      const me = await b.getMe();
      cachedBotUsername = me.username;
      return cachedBotUsername;
    }
  } catch (err) {
    log.error('Failed to get bot username', { error: err.message });
  }
  return process.env.TELEGRAM_BOT_USERNAME || 'SureOddsBot';
}

async function sendBotMessage(chatId, text) {
  try {
    const b = getBot();
    if (b) {
      await b.sendMessage(chatId, text, { parse_mode: 'Markdown' });
    }
  } catch (err) {
    log.error('Failed to send bot message', { error: err.message, chatId });
  }
}

module.exports = router;
