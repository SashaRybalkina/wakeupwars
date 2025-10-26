// TypingRace.tsx
// Version: Move on correct keystroke (no lag even if typing fast)

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

const MOCK_MODE = true;
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

const SAMPLE_TEXT =
  "The quick brown fox jumps over the lazy dog. Typing race should be smooth, accurate, and fun.";

const formatTime = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
};

const TypingRace: React.FC<Props> = ({ navigation }) => {
  const route = useRoute();
  const { challName = 'Typing Race' } = (route.params as any) || {};

  const [waitingActive, setWaitingActive] = useState(true);
  const [countdown, setCountdown] = useState<number | null>(COUNTDOWN_START);
  const [gameTime, setGameTime] = useState(GAME_SECONDS);
  const [gameOver, setGameOver] = useState(false);

  const [playerProgress, setPlayerProgress] = useState<PlayerProgress[]>([
    { username: 'You', color: 'gold', progress: 0, wpm: 0, isMe: true },
    { username: 'Alex', color: 'dodgerblue', progress: 0, wpm: 0 },
    { username: 'Bob', color: 'hotpink', progress: 0, wpm: 0 },
  ]);

  const playerMapRef = useRef<Map<string, Animated.Value>>(new Map());
  const [input, setInput] = useState('');
  const totalChars = SAMPLE_TEXT.length;

  const me = useMemo(
    () => playerProgress.find(p => p.isMe) || playerProgress[0],
    [playerProgress]
  );

  const accuracy = useMemo(() => {
    if (input.length === 0) return 100;
    const correct = input.split('').filter((ch, i) => ch === SAMPLE_TEXT[i]).length;
    return Math.max(0, Math.round((correct / input.length) * 100));
  }, [input]);

  const ensureAnim = (username: string) => {
    if (!playerMapRef.current.has(username)) {
      playerMapRef.current.set(username, new Animated.Value(0));
    }
    return playerMapRef.current.get(username)!;
  };

  // 🏎️ smooth animation on each progress update
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

  // Countdown
  useEffect(() => {
    if (!waitingActive) return;
    setGameOver(false);

    if (MOCK_MODE) {
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
    }
  }, [waitingActive]);

  // Timer
  useEffect(() => {
    if (waitingActive || gameOver) return;
    if (gameTime <= 0) {
      setGameOver(true);
      Alert.alert('⏰ Time’s up!', 'Race finished.', [
        { text: 'Play Again', onPress: resetRace },
        { text: 'Exit', onPress: () => navigation.goBack() },
      ]);
      return;
    }
    const t = setInterval(() => setGameTime(t => t - 1), 1000);
    return () => clearInterval(t);
  }, [waitingActive, gameOver, gameTime, navigation]);

  // opponent move 1 char at a time
  useEffect(() => {
    if (waitingActive || gameOver || !MOCK_MODE) return;
    const interval = setInterval(() => {
      setPlayerProgress(prev =>
        prev.map(p => {
          if (p.isMe) return p;
          const newProgress = Math.min(100, p.progress + (1 / totalChars) * 100);
          return { ...p, progress: newProgress };
        })
      );
    }, 500);
    return () => clearInterval(interval);
  }, [waitingActive, gameOver, totalChars]);

  const resetRace = () => {
    setInput('');
    setPlayerProgress(ps => ps.map(p => ({ ...p, progress: 0, wpm: 0 })));
    setWaitingActive(true);
    setCountdown(COUNTDOWN_START);
    setGameTime(GAME_SECONDS);
    setGameOver(false);
  };

  // ✅ move on each correct keystroke
  const onChangeInput = (text: string) => {
    if (gameOver || waitingActive) return;
    const limited = text.slice(0, totalChars);
    setInput(limited);

    const correctChars = limited.split('').filter((ch, i) => ch === SAMPLE_TEXT[i]).length;
    const newProgress = Math.min(100, (correctChars / totalChars) * 100);

    // ✨ calculate WPM
    const elapsedSeconds = GAME_SECONDS - gameTime;
    const newWpm = elapsedSeconds > 0 ? Math.round((correctChars / 5) / (elapsedSeconds / 60)) : 0;

    setPlayerProgress(prev =>
      prev.map(p => 
        p.isMe ? { ...p, progress: newProgress, wpm: newWpm } : p
      )
    );
  };

  const renderTypingText = () => {
    const typed = input;
    const correctLen = typed.split('').findIndex((ch, i) => ch !== SAMPLE_TEXT[i]);
    const firstIncorrectIndex = correctLen === -1 ? typed.length : correctLen;

    const correctPart = SAMPLE_TEXT.slice(0, firstIncorrectIndex);
    const incorrectPart = SAMPLE_TEXT.slice(firstIncorrectIndex, typed.length);
    const remainingPart = SAMPLE_TEXT.slice(typed.length);

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
      {/* Waiting Room */}
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

      {/* Countdown */}
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

          <Text style={styles.title}>{challName || 'Typing Race'}</Text>

          {/* Player Rows */}
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

          {/* Typing Stats */}
          <View style={styles.headerStats}>
            <Text style={styles.headerStatText}>⏱ {formatTime(gameTime)}</Text>
            <Text style={styles.headerStatText}>WPM {me?.wpm ?? 0}</Text>
            <Text style={styles.headerStatText}>Acc {accuracy}%</Text>
          </View>

          {/* Typing Area */}
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
