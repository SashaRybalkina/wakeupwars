// TypingRace.tsx

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Animated,
  Dimensions,
} from 'react-native';
import { NavigationProp, useRoute } from '@react-navigation/native';
import { BASE_URL, endpoints } from '../../api';
import { useUser } from '../../context/UserContext';
import { getAccessToken } from "../../auth";

const GAME_SECONDS = 40;
const CAR_SIZE = 24;
const COUNTDOWN_START = 3;

const screenWidth = Dimensions.get('window').width;
const SIDE_PADDING = 10;
const FLAG_WIDTH = 24;
const PROGRESS_WIDTH = 50;
const remainingWidth = screenWidth - SIDE_PADDING * 2 - FLAG_WIDTH - PROGRESS_WIDTH;

const NAME_RATIO = 0.3;
const TRACK_RATIO = 0.7;
const NAME_WIDTH = remainingWidth * NAME_RATIO;
const TRACK_WIDTH = remainingWidth * TRACK_RATIO;

type Props = { navigation: NavigationProp<any>; };
type PlayerProgress = { username: string; color: string; progress: number; wpm: number; isMe?: boolean; };

const formatTime = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
};

const TypingRace: React.FC<Props> = ({ navigation }) => {
  const route = useRoute();
  const { challId, challName = 'Typing Race' } = (route.params as any) || {};
  const { user } = useUser();

  // ===============================
  // ⏳ Game State (shared between solo & multiplayer)
  // ===============================
  const [waitingActive, setWaitingActive] = useState(false);
  
  const [countdown, setCountdown] = useState<number | null>(COUNTDOWN_START);
  const [gameTime, setGameTime] = useState(GAME_SECONDS);
  const [gameOver, setGameOver] = useState(false);
  const [hasFinished, setHasFinished] = useState(false);
  const [isMultiplayer, setIsMultiplayer] = useState(false);

  // ===============================
  // 🧑 Player Data
  // ===============================
  const [playerProgress, setPlayerProgress] = useState<PlayerProgress[]>([
    { username: user?.username || 'You', color: 'gold', progress: 0, wpm: 0, isMe: true },
  ]);

  const playerMapRef = useRef<Map<string, Animated.Value>>(new Map());
  const [input, setInput] = useState('');
  const lastInputRef = useRef('');               
  const [typedCount, setTypedCount] = useState(0);   
  const [errorCount, setErrorCount] = useState(0);   
  const [passage, setPassage] = useState('');
  const [gameStateId, setGameStateId] = useState<number | null>(null);

  const totalChars = passage.length;

  const me = useMemo(
    () => playerProgress.find(p => p.isMe) || playerProgress[0],
    [playerProgress]
  );

  const accuracy = useMemo(() => {
    if (typedCount === 0) return 100;
    const correct = Math.max(0, typedCount - errorCount);
    return Math.round((correct / typedCount) * 100);
  }, [typedCount, errorCount]);

  // ===============================
  // 🪝 Animation handling
  // ===============================
  const ensureAnim = (username: string) => {
    if (!playerMapRef.current.has(username)) {
      playerMapRef.current.set(username, new Animated.Value(0));
    }
    return playerMapRef.current.get(username)!;
  };

  useEffect(() => {
    playerProgress.forEach(p => {
      const anim = ensureAnim(p.username);
      anim.stopAnimation();
      Animated.spring(anim, {
        toValue: p.progress,
        speed: 12,
        bounciness: 0,
        useNativeDriver: false,
      }).start();
    });
  }, [playerProgress]);

  // ===============================
  // 🧭 Init: Fetch typing passage from API
  // ===============================
  useEffect(() => {
    const fetchGame = async () => {
      try {
        const accessToken = await getAccessToken();
        console.log('[DEBUG] accessToken:', accessToken);
        if (!accessToken) throw new Error('Not authenticated');

        const res = await fetch(endpoints.typingRaceCreate, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ challenge_id: challId }),
        });
        
        if (!res.ok) throw new Error('Failed to create game');
        const data = await res.json();

        console.log('[DEBUG] typingRaceCreate response:', data);

        setPassage(data.text);
        setGameStateId(data.game_state_id);
        setIsMultiplayer(data.is_multiplayer);

        if (data.is_multiplayer) {
          setWaitingActive(true);
          // if (data.join_deadline_at) {
          //   setJoinDeadlineISO(data.join_deadline_at);
          //   startLocalCountdown(data.join_deadline_at);
          // }
          // connectWebSocket(data.game_state_id); 
        } else {
          // ✅ single-player → start immediately
          setWaitingActive(false);
        }


      } catch (err) {
        console.error(err);
        Alert.alert('Error', 'Failed to start game.');
      }
    };

    fetchGame();
  }, [challId]);

  // ===============================
  // 📡 WebSocket Placeholder
  // ===============================
  /*
  const socketRef = useRef<WebSocket | null>(null);

  const connectWebSocket = async (id: number) => {
    const accessToken = await getAccessToken();
    const wsUrl = `${BASE_URL.replace(/^http/, 'ws')}/ws/typing/${id}/?token=${accessToken}`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => console.log('[Typing WS] connected');
    ws.onclose = () => console.log('[Typing WS] disconnected');
    ws.onerror = (e) => console.error('[Typing WS] error:', e);

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === 'player_progress') {
        setPlayerProgress(prev => prev.map(p =>
          p.username === msg.username ? { ...p, progress: msg.progress, wpm: msg.wpm } : p
        ));
      }
    };

    socketRef.current = ws;
  };
  */

  // ===============================
  // 🕒 Countdown Timer
  // ===============================
  useEffect(() => {
    if (!waitingActive) return;
    setGameOver(false);

    let c = COUNTDOWN_START;
    setCountdown(c);
    const timer = setInterval(() => {
      c -= 1;
      setCountdown(c);
      if (c <= 0) {
        clearInterval(timer);
        setWaitingActive(false);
        setCountdown(null);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [waitingActive]);

  // ===============================
  // ⏳ Game Timer
  // ===============================
  useEffect(() => {
    if ( !passage || waitingActive || gameOver) return;
    if (gameTime <= 0) {
      finishGame();
      return;
    }
    const t = setInterval(() => setGameTime(t => t - 1), 1000);
    return () => clearInterval(t);
  }, [ passage, waitingActive, gameOver, gameTime]);

  // ===============================
  // 🔄 Reset Game
  // ===============================
  const resetRace = () => {
    setInput('');
    lastInputRef.current = '';
    setTypedCount(0);
    setErrorCount(0);
    setPlayerProgress(ps => ps.map(p => ({ ...p, progress: 0, wpm: 0 })));
    setWaitingActive(true);
    setCountdown(COUNTDOWN_START);
    setGameTime(GAME_SECONDS);
    setHasFinished(false);
    setGameOver(false);
  };

  // ===============================
  // 🏁 Finish Game
  // ===============================
  const finishGame = async () => {
  setGameOver(true);
  Alert.alert(
    '🎉 Race Finished',
    `Accuracy: ${accuracy}%\nWPM: ${me?.wpm ?? 0}\nErrors: ${errorCount}`,
    [
      { text: 'Play Again', onPress: resetRace },
      { text: 'Exit', onPress: () => navigation.goBack() },
    ]
  );
  try {
    const accessToken = await getAccessToken();
    if (!accessToken) throw new Error('Not authenticated');

    const res = await fetch(endpoints.typingRaceFinalize, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        game_state_id: gameStateId,
        accuracy,
      }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Submit failed');

    // Alert.alert('🎉 Race Finished', `Accuracy: ${data.accuracy}%\nScore: ${data.final_score}`, [
    //   { text: 'Play Again', onPress: resetRace },
    //   { text: 'Exit', onPress: () => navigation.goBack() },
    // ]);
  } catch (err) {
    console.error(err);
    Alert.alert('Error', 'Failed to submit result.');
  }
};


  // ===============================
  // ⌨️ Handle Player Input
  // ===============================
  const onChangeInput = (rawText: string) => {
  if (gameOver || waitingActive) return;

  const limited = rawText.slice(0, totalChars);
  const prev = lastInputRef.current;

  // Deletions should not affect typed_count or error_count
  if (limited.length < prev.length) {
    setInput(limited);
    lastInputRef.current = limited;
    return;
  }

  // 🆕 Find newly added characters and check for errors
  const added = limited.slice(prev.length);
  if (added.length > 0) {
    let typedDelta = 0;
    let errorDelta = 0;

    for (let i = 0; i < added.length; i++) {
      const idx = prev.length + i;
      typedDelta += 1;
      if (added[i] !== passage[idx]) {
        errorDelta += 1;
      }
    }

    setTypedCount(tc => tc + typedDelta);
    setErrorCount(ec => ec + errorDelta);
  }

  // 📈 Progress is calculated based on correct characters only
  const correctNow = limited.split('').filter((ch, i) => ch === passage[i]).length;
  const newProgress = Math.min(100, (correctNow / totalChars) * 100);

  const elapsedSeconds = GAME_SECONDS - gameTime;
  const newWpm =
    elapsedSeconds > 0 ? Math.round((correctNow / 5) / (elapsedSeconds / 60)) : 0;

  setPlayerProgress(prev =>
    prev.map(p =>
      p.isMe ? { ...p, progress: newProgress, wpm: newWpm } : p
    )
  );

  setInput(limited);
  lastInputRef.current = limited;

  if (limited.length === totalChars) {
    if (!isMultiplayer) {
      // ✅ Single-player: finish immediately
      finishGame();
    } else {
      // 👥 Multiplayer: mark as finished, but don't end the game yet
      setHasFinished(true);
    }
  }
};


  // ===============================
  // 📝 Render Typing Passage
  // ===============================
  const renderTypingText = () => {
    const typed = input;
    const correctLen = typed.split('').findIndex((ch, i) => ch !== passage[i]);
    const firstIncorrectIndex = correctLen === -1 ? typed.length : correctLen;

    const correctPart = passage.slice(0, firstIncorrectIndex);
    const incorrectPart = passage.slice(firstIncorrectIndex, typed.length);
    const remainingPart = passage.slice(typed.length);

    return (
      <Text style={styles.textLine}>
        <Text style={styles.correct}>{correctPart}</Text>
        <Text style={styles.incorrect}>{incorrectPart}</Text>
        <Text style={styles.remaining}>{remainingPart}</Text>
      </Text>
    );
  };

  return (
    <ImageBackground
      source={require('../../images/cgpt.png')}
      style={styles.background}
      resizeMode="cover"
    >
      {waitingActive && (
        <View style={styles.waitingOverlay}>
          <View style={styles.waitingCard}>
            <Text style={styles.waitingTitle}>Waiting Room</Text>
            <Text style={styles.waitingText}>Players: {playerProgress.length}</Text>
            <Text style={styles.waitingText}>
              {countdown !== null ? `Starts in ${countdown}` : 'Starting...'}
            </Text>
          </View>
        </View>
      )}

      {countdown !== null && waitingActive && (
        <View style={styles.countdownOverlay}>
          <Text style={styles.countdownText}>{countdown}</Text>
        </View>
      )}

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.select({ ios: 'padding', android: undefined })}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <TouchableOpacity style={styles.exitButton} onPress={() => navigation.goBack()}>
            <Text style={styles.exitText}>Exit</Text>
          </TouchableOpacity>

          <Text style={styles.title}>{challName}</Text>

          {/* 🏎️ Progress Board */}
          <View style={styles.progressBoard}>
            {playerProgress.map(p => {
              const anim = ensureAnim(p.username);
              const animatedLeft = anim.interpolate({
                inputRange: [0, 100],
                outputRange: [0, TRACK_WIDTH - CAR_SIZE],
              });

              return (
                <View key={p.username} style={styles.playerRow}>
                  <View
                    style={[
                      styles.nameBox,
                      p.isMe && {
                        backgroundColor: `${p.color}30`,
                        borderColor: p.color,
                        borderWidth: 1.5,
                      },
                    ]}
                  >
                    <Text style={styles.playerName} numberOfLines={1} ellipsizeMode="tail">
                      {p.username}
                    </Text>
                  </View>

                  <View style={styles.trackWrapper}>
                    <View style={[styles.track, { width: TRACK_WIDTH }]}>
                      <View style={styles.trackLine} />
                      <Animated.View
                        style={[
                          styles.car,
                          { left: animatedLeft, backgroundColor: p.color },
                        ]}
                      >
                        <Text style={styles.carIcon}>🚗</Text>
                      </Animated.View>
                    </View>
                  </View>

                  <View style={styles.finishFlag}>
                    <Text style={styles.flagIcon}>🏁</Text>
                  </View>

                  <Text style={styles.progressText}>{Math.round(p.progress)}%</Text>
                </View>
              );
            })}
          </View>

          <View style={styles.headerStats}>
            <Text style={styles.headerStatText}>⏱ {formatTime(gameTime)}</Text>
            <Text style={styles.headerStatText}>WPM {me?.wpm ?? 0}</Text>
            <Text style={styles.headerStatText}>❌ {errorCount}</Text>
            <Text style={styles.headerStatText}>Acc {accuracy}%</Text>
          </View>

          <View style={styles.typingArea}>
            {renderTypingText()}
            <TextInput
              style={styles.input}
              placeholder="Start typing here..."
              placeholderTextColor="#ccc"
              value={input}
              onChangeText={onChangeInput}
              autoCorrect={false}
              autoCapitalize="none"
              editable={!waitingActive && !gameOver}
              multiline
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ImageBackground>
  );
};



const styles = StyleSheet.create({
  background: { flex: 1 },
  container: { flexGrow: 1, paddingTop: 60, paddingBottom: 40 },
  exitButton: {
    position: 'absolute',
    top: 40,
    left: 20,
    padding: 8,
    backgroundColor: 'white',
    borderRadius: 5,
    zIndex: 5,
  },
  exitText: { fontWeight: 'bold' },
  title: { fontSize: 28, fontWeight: 'bold', color: 'white', textAlign: 'center', marginTop: 4 },
  headerStats: { flexDirection: 'row', gap: 12, marginTop: 8, justifyContent: 'center' },
  headerStatText: { color: 'white', fontWeight: '600' },
  waitingOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', zIndex: 10,
  },
  waitingCard: {
    width: '85%',
    paddingVertical: 24, paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderColor: 'rgba(255,255,255,0.25)', borderWidth: 1,
  },
  waitingTitle: { color: 'white', fontSize: 22, fontWeight: '700', textAlign: 'center', marginBottom: 8 },
  waitingText: { color: 'white', fontSize: 14, textAlign: 'center', marginBottom: 6 },
  countdownOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', zIndex: 20,
  },
  countdownText: {
    fontSize: 72, color: '#FFD700', fontWeight: '900', textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 2, height: 2 }, textShadowRadius: 8,
  },
  progressBoard: { width: '100%', marginTop: 20 },
  playerRow: {
    flexDirection: 'row', alignItems: 'center',
    marginBottom: 14, paddingHorizontal: SIDE_PADDING,
  },
  nameBox: {
    width: NAME_WIDTH,
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 0,
    borderRadius: 6,
  },
  playerName: { color: '#fff', fontWeight: 'bold', textAlign: 'left' },
  trackWrapper: { width: TRACK_WIDTH, justifyContent: 'center', alignItems: 'center' },
  track: { position: 'relative', height: 30, justifyContent: 'center' },
  trackLine: { height: 6, backgroundColor: '#555', borderRadius: 3, width: '100%' },
  car: {
    position: 'absolute', top: -10,
    width: CAR_SIZE, height: CAR_SIZE,
    borderRadius: CAR_SIZE / 2, justifyContent: 'center', alignItems: 'center',
  },
  carIcon: { fontSize: 18 },
  finishFlag: { width: FLAG_WIDTH, justifyContent: 'center', alignItems: 'center' },
  flagIcon: { fontSize: 20 },
  progressText: { width: PROGRESS_WIDTH, color: '#fff', textAlign: 'left', fontWeight: 'bold' },
  typingArea: {
    width: '100%', marginTop: 24, padding: 16,
    backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: 12,
  },
  textLine: { fontSize: 18, lineHeight: 26, marginBottom: 12 },
  correct: { color: '#7CFC00', fontWeight: '600' },
  incorrect: { color: '#FF6B6B', fontWeight: '600' },
  remaining: { color: '#eee' },
  input: {
    minHeight: 80, padding: 12,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 8, color: '#000',
  },
});

export default TypingRace;
