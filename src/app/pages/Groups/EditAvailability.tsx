import React, { useEffect, useState, useMemo } from 'react';
import { scheduleAlarms } from '../../Alarm';
import { Dimensions, Modal } from 'react-native';

import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ImageBackground,
} from 'react-native';
import { NavigationProp, useRoute } from '@react-navigation/native';
import { useUser } from '../../context/UserContext';
import { BASE_URL, endpoints } from '../../api';
import { getAccessToken } from '../../auth';
import { scheduleAlarmsForUser } from '../../alarmService';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const DAYS = ["M", "T", "W", "TH", "F", "S", "SU"];
const DayOfWeekLabels: Record<number, string> = { 1: "M", 2: "T", 3: "W", 4: "TH", 5: "F", 6: "S", 7: "SU" }

// Zero-pad to match API format like "06:00"
// const TIMES = Array.from({ length: 12 }, (_, i) => `${String(i + 6).padStart(2, '0')}:00`);

// const TIMES = Array.from({ length: 44 }, (_, i) => {
//   const totalMinutes = 4 * 60 + i * 15; // start at 4:00
//   const hours24 = Math.floor(totalMinutes / 60);
//   const minutes = totalMinutes % 60;

//   const period = hours24 >= 12 ? "PM" : "AM";
//   const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;

//   return `${hours12}:${String(minutes).padStart(2, "0")} ${period}`;
// });


// const TIMES = Array.from({ length: 61 }, (_, i) => {
//   const totalMinutes = 4 * 60 + i * 15; // start at 4:00
//   const hours24 = Math.floor(totalMinutes / 60);
//   const minutes = totalMinutes % 60;

//   const period = hours24 >= 12 ? "PM" : "AM";
//   const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;

//   return `${hours12}:${String(minutes).padStart(2, "0")} ${period}`;
// });

const TIMES = Array.from({ length: 100 }, (_, i) => {
  const totalMinutes = 19 * 60 + i * 5; // start at 4:00
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
});

// const START_MIN = 14 * 60; // 10:00 PM
// const END_MIN = 16 * 60;   // 12:00 AM next day
// const STEP_MIN = 1;

// const TIMES = Array.from(
//   { length: Math.floor((END_MIN - START_MIN) / STEP_MIN) + 1 }, // 121 entries (includes 12:00 AM)
//   (_, i) => {
//     const totalMinutes = START_MIN + i * STEP_MIN;
//     const hours24 = Math.floor(totalMinutes / 60) % 24;
//     const minutes = totalMinutes % 60;
//     return `${String(hours24).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`; // "HH:MM"
//   }
// );

type Props = {
  // use any to include .replace; or define proper stack prop if available
  navigation: any
}

type AvailabilityEntry = {
  uID: number;
  name: string;
  dayOfWeek: number;
  alarmTime: string; // may come as "HH:MM" or "HH:MM:SS"
};

type DaySchedule = {
  dayOfWeek: number
  games: { id?: number; name: string; order: number }[]
}

const transparentColors = [
  'rgba(255, 0, 0, 0.3)',
  'rgba(0, 255, 0, 0.3)',
  'rgba(0, 0, 255, 0.3)',
  'rgba(255, 255, 0, 0.3)',
  'rgba(255, 0, 255, 0.3)',
  'rgba(0, 255, 255, 0.3)',
  'rgba(255, 165, 0, 0.3)',
  'rgba(128, 0, 128, 0.3)',
  'rgba(0, 128, 0, 0.3)',
  'rgba(128, 128, 0, 0.3)',
];

// Normalize any "HH:MM[:SS]" to "HH:MM"
const toHHMM = (t?: string) => (t ? t.slice(0, 5) : '');

const EditAvailability: React.FC<Props> = ({ navigation }) => {
  const route = useRoute();
  const { pendingChallengeId, pendingChallengeName, pendingChallengeStartDate, pendingChallengeEndDate, accepted, groupId } = route.params as { 
    groupId: number,
    pendingChallengeId: number, 
    pendingChallengeName: string, 
    pendingChallengeStartDate: string,
    pendingChallengeEndDate: string,
    accepted: number };

  console.log("EditAvailability route params:", route.params);

  const { user, logout } = useUser();

  const [availability, setAvailability] = useState<AvailabilityEntry[]>([]);
  const [userAvailability, setUserAvailability] = useState<AvailabilityEntry[]>([]);
  const [declinedList, setDeclinedList] = useState<string[]>([])
  const [loading, setLoading] = useState(true);
  const [isInitiator, setIsInitiator] = useState(false);
  const [participationFee, setParticipationFee] = useState<number>(0);
  const [numCoins, setNumCoins] = useState<number>(0);
  // const [challengeStartDate, setChallengeStartDate] = useState<string | null>(
  //   pendingChallengeStartDate ?? null
  // );
  const [infoVisible, setInfoVisible] = React.useState(false);
  const [finalizing, setFinalizing] = useState(false);

  const [schedule, setSchedule] = useState<
    {
      dayOfWeek: number
      games: { name: string; order: number }[]
    }[]
  >([])

  // Which day is currently selected by the user
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const currentDay = schedule.find((d) => d.dayOfWeek === selectedDay)
  const visibleGames = currentDay?.games ?? []

  const uniqueUserIds = [...new Set(availability.map(a => a.uID))];

  // Assign a color to each user
  const userColorMap = useMemo(() => {
    const colorMap: Record<number, string> = {};
    uniqueUserIds.forEach((id, index) => {
      colorMap[id] = transparentColors[index % transparentColors.length] || 'transparent';
      // console.log('color for', id, colorMap[id]);
    });
    return colorMap;
  }, [availability]);


const activeDays = useMemo(() => {
  const uniqueDays = new Set(availability.map(a => a.dayOfWeek));
  return Array.from(uniqueDays).sort((a, b) => a - b);
}, [availability]);


const [pendingToggles, setPendingToggles] = useState<AvailabilityEntry[]>([]);

// helper to compare cells (day + HH:MM)
const cellEquals = (a: AvailabilityEntry, b: AvailabilityEntry) =>
  a.dayOfWeek === b.dayOfWeek && toHHMM(a.alarmTime) === toHHMM(b.alarmTime);

// fetch function extracted so we can call it on mount and after submit
const fetchAvailabilities = async () => {
  if (!user?.id) {
    console.error("userId is missing!");
    return;
  }
  setLoading(true);
  try {
          const accessToken = await getAccessToken();
          if (!accessToken) {
                  Alert.alert(
                    "Session expired",
                    "Your login session has expired. Please log in again.",
                    [
                      {
                        text: "OK",
                        onPress: async () => {
                          await logout();
                          navigation.reset({
                            index: 0,
                            routes: [{ name: "Login" }],
                          });
                        },
                      },
                    ],
                    { cancelable: false }
                  );

                  return;
          }
    const res = await fetch(endpoints.getAvailabilities(pendingChallengeId, Number(user.id)), {
                headers: {
                  Authorization: `Bearer ${accessToken}`
                }
              });
    const data = await res.json();
    console.log(data);
    setAvailability(data.availabilities);
    setUserAvailability(data.availabilities.filter((entry: AvailabilityEntry) => entry.uID === user.id));
    setPendingToggles([]); // clear pending toggles after full refresh
    setIsInitiator(data.initiator_id === user?.id);
    // setChallengeStartDate(data.start_date);
    setDeclinedList(data.declined_list)
    setParticipationFee(data.participation_fee)
    setNumCoins(data.num_user_coins)
    if (numCoins < participationFee) {
      Alert.alert('You do not have enough coins!', `You need ${participationFee} coins, you have ${numCoins} coins.`, [
        { text: 'OK', onPress: () => navigation.navigate('GroupDetails', { groupId }) },
      ]);
    }

    const dedupedSchedule: DaySchedule[] = data.gameSchedule.map((day: DaySchedule) => ({
        ...day,
      }))

    setSchedule(dedupedSchedule)

    if (data.gameSchedule.length > 0) {
      setSelectedDay(data.gameSchedule[0].dayOfWeek)
    }

  } catch (error) {
    console.error("Error fetching availabilities:", error);
  } finally {
    setLoading(false);
  }
};

useEffect(() => {
  fetchAvailabilities();
}, [pendingChallengeId, user]);



// // --- updated toggleCell: also maintain pendingToggles as symmetric diff ---
// const toggleCell = (dayIdx: number, timeIdx: number) => {
//   const dayOfWeek = dayIdx + 1;
//   const timeStr = TIMES[timeIdx];
//   if (!timeStr || !user?.id || !user?.name) return;

//   const entryMatches = (entry: AvailabilityEntry) =>
//     entry.dayOfWeek === dayOfWeek && toHHMM(entry.alarmTime) === timeStr;

//   const isUserInCell = userAvailability.some(entryMatches);
//   const newEntry: AvailabilityEntry = {
//     uID: Number(user.id),
//     name: user.name,
//     dayOfWeek,
//     alarmTime: timeStr,
//   };

//   if (!isUserInCell) {
//     // add locally
//     setUserAvailability(prev => [...prev, newEntry]);
//     setAvailability(prev => [...prev, newEntry]);
//   } else {
//     // remove locally
//     setUserAvailability(prev =>
//       prev.filter(entry => !(entry.dayOfWeek === dayOfWeek && toHHMM(entry.alarmTime) === timeStr))
//     );
//     setAvailability(prev =>
//       prev.filter(entry => !(entry.uID === user.id && entry.dayOfWeek === dayOfWeek && toHHMM(entry.alarmTime) === timeStr))
//     );
//   }

//   // maintain pendingToggles as symmetric difference (toggle in/out)
//   setPendingToggles(prev => {
//     const exists = prev.some(e => e.dayOfWeek === dayOfWeek && toHHMM(e.alarmTime) === timeStr);
//     if (exists) {
//       // user toggled this cell back — remove from pending
//       return prev.filter(e => !(e.dayOfWeek === dayOfWeek && toHHMM(e.alarmTime) === timeStr));
//     } else {
//       // record new toggle
//       return [...prev, newEntry];
//     }
//   });
// };


const toggleCell = (dayOfWeek: number, timeIdx: number) => {
  const timeStr = TIMES[timeIdx];
  if (!timeStr || !user?.id || !user?.name) return;

  const entryMatches = (entry: AvailabilityEntry) =>
    entry.dayOfWeek === dayOfWeek && toHHMM(entry.alarmTime) === timeStr;

  const isUserInCell = userAvailability.some(entryMatches);
  const newEntry: AvailabilityEntry = {
    uID: Number(user.id),
    name: user.name,
    dayOfWeek,
    alarmTime: timeStr,
  };

  if (!isUserInCell) {
    setUserAvailability(prev => [...prev, newEntry]);
    setAvailability(prev => [...prev, newEntry]);
  } else {
    setUserAvailability(prev => prev.filter(e => !entryMatches(e)));
    setAvailability(prev => prev.filter(e => !(e.uID === user.id && entryMatches(e))));
  }

  setPendingToggles(prev => {
    const exists = prev.some(entryMatches);
    if (exists) return prev.filter(e => !entryMatches(e));
    return [...prev, newEntry];
  });
};





  const isUserSlotSelected = (dayIdx: number, timeIdx: number) => {
    const dayOfWeek = dayIdx + 1;
    const timeStr = TIMES[timeIdx];
    if (!timeStr) return false;
    return userAvailability.some(
      entry => entry.dayOfWeek === dayOfWeek && toHHMM(entry.alarmTime) === timeStr
    );
  };

  const getUsersInSlot = (dayIdx: number, timeIdx: number) => {
    const dayOfWeek = dayIdx + 1;
    const timeStr = TIMES[timeIdx];
    if (!timeStr) return [];
    // Strict equality on normalized "HH:MM"
    return availability.filter(
      entry => entry.dayOfWeek === dayOfWeek && toHHMM(entry.alarmTime) === timeStr
    );
  };


  const formatTo12Hour = (time24: string) => {
    const [hStr, mStr] = time24.split(":");
    if (!hStr) return;
    if (!mStr) return;
    let hours = parseInt(hStr, 10);
    const minutes = parseInt(mStr, 10);
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12 || 12;
    return `${hours}:${mStr} ${ampm}`;
};


const handleSubmit = async () => {
  const days = new Set(
    availability
      .filter(entry => entry.uID === user?.id)
      .map(entry => entry.dayOfWeek)
  );

  if (days.size < activeDays.length) {
    Alert.alert(
      "Error",
      "Please select at least one availability for each day."
    );
    return;
  }

  try {
    // payload already in 24-hour HH:MM
    const payload = pendingToggles.map(({ dayOfWeek, alarmTime }) => ({
      dayOfWeek,
      alarmTime, // already "HH:MM"
    }));

      const accessToken = await getAccessToken();
      if (!accessToken) {
                  Alert.alert(
                    "Session expired",
                    "Your login session has expired. Please log in again.",
                    [
                      {
                        text: "OK",
                        onPress: async () => {
                          await logout();
                          navigation.reset({
                            index: 0,
                            routes: [{ name: "Login" }],
                          });
                        },
                      },
                    ],
                    { cancelable: false }
                  );

                  return;
      }

    const res = await fetch(
      endpoints.setChallAvailability(Number(user?.id), pendingChallengeId),
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          "Authorization": `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ availability: payload }),
      }
    );

    if (!res.ok) throw new Error('Failed to update availability.');

    setPendingToggles([]);
    await fetchAvailabilities();

    Alert.alert('Success', 'Your availability was saved.', [
      { text: 'OK', onPress: () => navigation.navigate('GroupDetails', { groupId }) },
    ]);
  } catch (err: any) {
    Alert.alert('Error', err.message);
  }
};


//  const handleSubmit = async () => {
//   // convert pending toggles into payload entries (HH:MM)
//   const payload = pendingToggles.map(({ dayOfWeek, alarmTime }) => ({
//     dayOfWeek,
//     alarmTime: toHHMM(alarmTime),
//   }));

//   try {
//     const csrfRes = await fetch(`${BASE_URL}/api/csrf-token/`, {
//       credentials: 'include',
//     });
//     if (!csrfRes.ok) throw new Error('Failed to fetch CSRF token');
//     const { csrfToken } = await csrfRes.json();

//     const res = await fetch(endpoints.setChallAvailability(Number(user?.id), pendingChallengeId), {
//       method: 'POST',
//       credentials: 'include',
//       headers: {
//         'Content-Type': 'application/json',
//         'X-CSRFToken': csrfToken,
//       },
//       body: JSON.stringify({ availability: payload }),
//     });

//     if (!res.ok) throw new Error('Failed to update availability.');

//     // success -> clear pending toggles and re-fetch authoritative state
//     setPendingToggles([]);
//     await fetchAvailabilities();

//     Alert.alert('Success', 'Your availability was saved.');
//   } catch (err: any) {
//     Alert.alert('Error', err.message);
//   }
// }; 


    const handleDecline = async () => {
        try {
      const accessToken = await getAccessToken();
      if (!accessToken) {
                  Alert.alert(
                    "Session expired",
                    "Your login session has expired. Please log in again.",
                    [
                      {
                        text: "OK",
                        onPress: async () => {
                          await logout();
                          navigation.reset({
                            index: 0,
                            routes: [{ name: "Login" }],
                          });
                        },
                      },
                    ],
                    { cancelable: false }
                  );

                  return;
      }

      const res = await fetch(endpoints.declineChallengeInvite(Number(user?.id), pendingChallengeId), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          "Authorization": `Bearer ${accessToken}`,
        },
      });

      if (!res.ok) throw new Error('Failed to decline invite.');

            Alert.alert('Success', 'Invite declined', [
                { text: 'OK', onPress: () => navigation.navigate('GroupDetails', { groupId }) },
            ]);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  };


    const handleFinalizeSchedule = async () => {
      console.log("challengeStartDate")
      console.log(pendingChallengeStartDate)
      if (!pendingChallengeStartDate) {
        console.warn("Start date not loaded yet");
        return;
      }

      // TODO: the commented version will be final version (don't allow people to finalize on the start date
      // to give people time to set alarms, but for the sake of demoing, use the uncommented code below)
      // if (new Date() >= new Date(challengeStartDate)) {
      //   alert("Start date already passed.");
      //   return;
      // }
      // if (new Date() > new Date(challengeStartDate)) {
      //   alert("Start date already passed.");
      //   return;
      // }
      const today = new Date();
      const start = new Date(pendingChallengeStartDate);

      console.log(today)
      console.log(start)

      // Convert both to YYYY-MM-DD strings (local)
      const todayStr = today.toISOString().split("T")[0];
      const startStr = start.toISOString().split("T")[0];

      console.log("today: ", todayStr)
      console.log(startStr)

      // if (todayStr > startStr) {
      //   alert("Start date already passed.");
      //   return;
      // }

      try {
        setFinalizing(true);
        const accessToken = await getAccessToken();
        if (!accessToken) {
                    Alert.alert(
                      "Session expired",
                      "Your login session has expired. Please log in again.",
                      [
                        {
                          text: "OK",
                          onPress: async () => {
                            await logout();
                            navigation.reset({
                              index: 0,
                              routes: [{ name: "Login" }],
                            });
                          },
                        },
                      ],
                      { cancelable: false }
                    );

                    return;
        }

          const res = await fetch(endpoints.finalizeCollaborativeGroupChallengeSchedule(pendingChallengeId), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              "Authorization": `Bearer ${accessToken}`,
            },
          });
          if (!res.ok) throw new Error(`Failed to finalize schedule. (${res.status})`);

          // let challenge_id: number | null = null;
          // const text = await res.text();
          // if (text) {
          //   try {
          //     const json = JSON.parse(text);
          //     challenge_id = json?.challenge_id ?? null;
          //   } catch {
          //     // not JSON — ignore; we’ll fall back to pending id
          //   }
          // }

          // try {
          //     console.log("setting user alarms for challenge:")
          //     console.log(pendingChallengeId)
          //     // await scheduleAlarmsForUser(pendingChallengeId, pendingChallengeName, Number(user?.id));
          // } catch (e) {
          //     console.warn('Failed to schedule alarms for new challenge', e);
          // }

          // const targetId = challenge_id ?? pendingChallengeId;
          Alert.alert('Success', 'Schedule finalized.', [
            {
              text: 'OK',
              // onPress: () =>
              //   navigation.navigate('ChallDetails', {
              //     challId: pendingChallengeId,
              //     challName: pendingChallengeName,
              //     whichChall: 'Group',
              //   }),
              onPress: () =>
                navigation.navigate('ChallSchedule', {
                  challId: pendingChallengeId,
                  challName: pendingChallengeName,
                  fromSearch: false,
                }),
            },
          ]);
        } catch (err: any) {
          Alert.alert('Error', err.message);
        } finally {
          setFinalizing(false);
        }
    };

return (
  <ImageBackground
    source={require('../../images/cgpt.png')}
    style={styles.background}
    resizeMode="cover"
  >

      <View style={styles.container}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={28} color="#FFF" />
        </TouchableOpacity>

      {loading ? (
        <ActivityIndicator size="large" color="#FFD700" />
      ) : (
<ScrollView
  contentContainerStyle={styles.scrollContentContainer}
  showsVerticalScrollIndicator={false}
>
  {/* Challenge Info */}
  <View style={styles.challengeCard}>
    <Text style={styles.challengeTitle}>{pendingChallengeName}</Text>
    <View style={styles.challengeDetailsRow}>
      <Text style={styles.challengeDateText}>Starts: {pendingChallengeStartDate}</Text>
      <Text style={styles.challengeDateText}>Ends: {pendingChallengeEndDate}</Text>
    </View>
    <View style={styles.feeRow}>
      <Text style={styles.coinText}>Participation Fee:</Text>
      <Text style={styles.coinValue}>{participationFee} 🪙</Text>
    </View>
  </View>

  {/* Days Selection */}
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>Challenge Days</Text>
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.daysScroll}
    >
      {activeDays.map((dayNum, idx) => {
        const dayLabel = DAYS[dayNum - 1];
        const dayData = schedule.find(d => DayOfWeekLabels[d.dayOfWeek] === dayLabel);
        const isActive = dayData?.dayOfWeek === selectedDay;

        return (
          <TouchableOpacity
            key={idx}
            style={[styles.dayBubble, isActive && styles.dayBubbleActive]}
            onPress={() => dayData && setSelectedDay(dayData.dayOfWeek)}
          >
            <Text style={[styles.dayBubbleText, isActive && styles.dayBubbleTextActive]}>
              {dayLabel}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  </View>

  {/* Games Section */}
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>
      {selectedDay ? `Games for ${DayOfWeekLabels[selectedDay]}` : "Select a Day"}
    </Text>
    {visibleGames.length > 0 ? (
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {visibleGames.map((game, index) => {
          const lower = game.name.toLowerCase();
          const isSudoku = lower.includes("sudoku");
          const isPattern = lower.includes("pattern");
          const isWordle = lower.includes("wordle");
          const isTyping = lower.includes("typing");
          const image = isSudoku
            ? require("../../images/sudoku.png")
            : isPattern
            ? require("../../images/patternGame.png")
            : isWordle
            ? require("../../images/wordle.png")
            : isTyping
            ? require("../../images/typingrace.png")
            : null;

          return (
            <TouchableOpacity key={index} style={styles.gameCard}>
              <Text style={styles.gameTitle}>{game.name}</Text>
              {image ? (
                <ImageBackground source={image} style={styles.gameImage} resizeMode="contain" />
              ) : (
                <>
                  <Text style={styles.gameDetail}>Repeats: -</Text>
                  <Text style={styles.gameDetail}>Minutes: -</Text>
                </>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    ) : (
      <View style={styles.emptyGamesContainer}>
        <Text style={styles.emptyGamesText}>Select a day to see games</Text>
      </View>
    )}
  </View>

  {/* Availability Editor */}
<View style={styles.formSection}>
  <View style={[styles.formSection2, { flexDirection: "row", alignItems: "center" }]}>
    <Text style={styles.sectionTitle}>Edit Availability</Text>

    <TouchableOpacity
      onPress={() => setInfoVisible(true)}
      style={{ marginLeft: 6 }}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <Ionicons name="help-circle" size={22} color="rgba(255,255,255,0.85)" />
    </TouchableOpacity>   
  </View>

  {/* Centered container sized to chart */}
  {/* <View style={styles.chartWrapper}> */}
    <View style={{ flexDirection: 'row' }}>
      {/* Fixed left column (times) */}
      <View>
        <View style={styles.cell} />
        {TIMES.map((time, timeIdx) => (
          <View key={timeIdx} style={styles.cell}>
            <Text style={styles.headerText}>{formatTo12Hour(time)}</Text>
          </View>
        ))}
      </View>

      {/* Scrollable grid */}
      <ScrollView horizontal>
        <View>
          {/* Header row (days) */}
          <View style={styles.row}>
            {DAYS.map((day, dayIdx) => (
              <View key={dayIdx} style={styles.cell}>
                <Text style={styles.headerText}>{day}</Text>
              </View>
            ))}
          </View>

          {/* Scrollable body */}
          <ScrollView>
            {TIMES.map((time, timeIdx) => (
              <View key={timeIdx} style={styles.row}>
                {DAYS.map((_, dayIdx) => {
                  const dayOfWeek = dayIdx + 1;
                  const isActive = activeDays.includes(dayOfWeek);

                  const users = availability.filter(
                    e =>
                      e.dayOfWeek === dayOfWeek &&
                      toHHMM(e.alarmTime) === time
                  );

                  return (
                    <TouchableOpacity
                      key={`${dayOfWeek}-${timeIdx}`}
                      style={[
                        styles.cell,
                        styles.interactiveCell,
                        !isActive && styles.disabledCell, // dim inactive days
                      ]}
                      disabled={!isActive}
                      onPress={() => isActive && toggleCell(dayOfWeek, timeIdx)}
                    >
                      {users.length > 0 && (
                        <View pointerEvents="none" style={styles.stripeOverlay}>
                          {users.map((u, i) => (
                            <View
                              key={i}
                              style={{
                                flex: 1,
                                backgroundColor:
                                  userColorMap[u.uID] ||
                                  'rgba(255,255,255,0.2)',
                              }}
                            />
                          ))}
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </ScrollView>
        </View>
      </ScrollView>
    </View>
  </View>
{/* </View> */}

      <Modal transparent visible={infoVisible} animationType="fade" onRequestClose={() => setInfoVisible(false)}>
        <View style={styles.infoBackdrop}>
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>How will our schedules be meshed?</Text>
            <Text style={styles.infoText}>
              Availability slots are in 15 mintute segments. Selecting, for example,
              the 6 AM slot on Monday means that you are available to have a 6 AM 
              alarm on Mondays. If all members are available at the same time slot on a given day,
              the system will select that time for all members' alarms on that day, and you will be
              scheduled to play the multiplayer version of that day's game.

              If not all members are available at the
              same time slot on a given day, you will be scheduled to play the singleplayer
              version of that day's game.
            </Text>
            <TouchableOpacity style={styles.infoClose} onPress={() => setInfoVisible(false)}>
              <Text style={styles.infoCloseText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>


  {/* Legends & Buttons */}
  {availability.length > 0 && (
    <View style={styles.legendContainer}>
      {Array.from(new Map(availability.map(({ uID, name }) => [uID, name])).entries()).map(
        ([id, name]) => (
          <View key={id} style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: userColorMap[id] }]} />
            <Text style={styles.legendText}>{name}</Text>
          </View>
        )
      )}
    </View>
  )}

  {declinedList.length > 0 && (
    <View style={styles.legendContainer}>
      <Text style={styles.legendText}>Declined:</Text>
      {declinedList.map((memName, index) => (
        <Text key={index} style={styles.memberName}>
          {memName}
        </Text>
      ))}
    </View>
  )}

  {/* <TouchableOpacity style={styles.saveButton} onPress={handleSubmit}>
    <Text style={styles.saveButtonText}>Save My Availability</Text>
  </TouchableOpacity> */}

{userAvailability.length > 0 && (
            <TouchableOpacity
            style={styles.createButton}
            onPress={handleSubmit}
          >
    <LinearGradient
      colors={["#FFD700", "#FFA500"]}
      start={{ x: 0, y: 0.5 }}
      end={{ x: 0.5, y: 1 }}
      style={[styles.createButtonGradient, { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }]}
    >
      <Text style={styles.createButtonText}>Save My Availability</Text>
    </LinearGradient>
          </TouchableOpacity>
)}


  {accepted !== 1 && (
    // <TouchableOpacity style={styles.saveButton} onPress={handleDecline}>
    //   <Text style={styles.saveButtonText}>Decline Challenge Invite</Text>
    // </TouchableOpacity>

            <TouchableOpacity
            style={styles.createButton}
            onPress={handleDecline}
          >
    <LinearGradient
      colors={["#FFD700", "#FFA500"]}
      start={{ x: 0, y: 0.5 }}
      end={{ x: 0.5, y: 1 }}
      style={[styles.createButtonGradient, { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }]}
    >
      <Text style={styles.createButtonText}>Decline Challenge Invite</Text>
    </LinearGradient>
          </TouchableOpacity>
  )}

  {isInitiator && uniqueUserIds.length > 1 && (
    // <TouchableOpacity style={styles.saveButton} onPress={handleFinalizeSchedule}>
    //   <Text style={styles.saveButtonText}>Finalize Challenge</Text>
    // </TouchableOpacity>

          <TouchableOpacity
            style={[styles.createButton, finalizing && { opacity: 0.6 }]}
            onPress={handleFinalizeSchedule}
            disabled={finalizing}
          >
    <LinearGradient
      colors={["#FFD700", "#FFA500"]}
      start={{ x: 0, y: 0.5 }}
      end={{ x: 0.5, y: 1 }}
      style={[styles.createButtonGradient, { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }]}
    >
      {finalizing ? <ActivityIndicator size="small" color="#FFF" style={{ marginRight: 8 }} /> : null}
      <Text style={styles.createButtonText}>{finalizing ? "Finalizing..." : "Finalize Challenge"}</Text>
    </LinearGradient>
          </TouchableOpacity>
  )}
</ScrollView>


      )}

  </View>
  </ImageBackground>
);

};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 40, 
    paddingHorizontal: 10,
  },
  background: {
    flex: 1,
  },
  scrollContentContainer: {
  paddingTop: 20,
  paddingHorizontal: 12,
  paddingBottom: 100, // give room for last button
},
  createButton: {
    borderRadius: 12,
    overflow: "hidden",
    marginVertical: 10,
    marginBottom: 30,
  },
  createButtonGradient: {
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  createButtonText: {
    color: "#333",
    fontSize: 18,
    fontWeight: "700",
  },
  title: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 20,
    textAlign: 'left',
  },
  grid: {
    borderWidth: 1,
    borderColor: '#ffffffd1',
  },
  row: {
    flexDirection: 'row',
  },
  cell: {
    width: 60,
    height: 30,
    borderWidth: 1,
    borderColor: '#ccc',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerText: {
    color: '#FFF',
    fontSize: 12,
    textAlign: 'center',
  },
    backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 15,
  },
  interactiveCell: {
    backgroundColor: "rgba(255, 255, 255, 0)",
  },
  userSelected: {
    borderColor: '#FFD700',
    borderWidth: 2,
  },
  // Absolute overlay that fills the cell and splits into equal stripes
  stripeOverlay: {
    position: 'absolute',
    top: 0, right: 0, bottom: 0, left: 0,
    flexDirection: 'row',
  },
  saveButton: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    paddingVertical: 14,
    borderRadius: 10,
    marginTop: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.38)",
  },
  saveButtonText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
  formSection: {
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
sectionLabel: {
  fontSize: 18,
  fontWeight: '600',
  color: '#FFF',
  marginBottom: 12,
},
legendContainer: {
  flexDirection: 'row',
  flexWrap: 'wrap',
  marginTop: 10,
  gap: 10,
  justifyContent: 'center',
  alignItems: 'center',
},
legendItem: {
  flexDirection: 'row',
  alignItems: 'center',
  marginRight: 12,
},
legendColor: {
  width: 16,
  height: 16,
  borderRadius: 4,
  marginRight: 6,
  borderWidth: 1,
  borderColor: '#FFF',
},
legendText: {
  color: '#FFF',
  fontSize: 14,
},
challengeInfoContainer: {
  backgroundColor: "rgba(255, 255, 255, 0.2)",
  padding: 16,
  borderRadius: 14,
  borderWidth: 1,
  borderColor: "rgba(255, 255, 255, 0.3)",
  marginBottom: 20,
  alignItems: 'center',
},

challengeTitle: {
  fontSize: 20,
  fontWeight: '700',
  color: '#FFF',
  marginBottom: 4,
  textAlign: 'center',
},

challengeEndDate: {
  fontSize: 14,
  color: '#FFF',
  fontStyle: 'italic',
},
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFF",
    textShadowColor: "rgba(0, 0, 0, 0.2)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  alarmSection: {
    marginBottom: 20,
  },
    dayCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    marginBottom: 8,
  },
  selectedDayCircle: {
    backgroundColor: "#FFD700",
    shadowColor: "#FFD700",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  activeDayCircle: {
    backgroundColor: "#FFA500",
    shadowColor: "#FFA500",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 5,
  },
  dayText: {
    fontWeight: "700",
    fontSize: 15,
    color: "#FFF",
  },
  selectedDayText: {
    color: "#000",
  },
  activeDayText: {
    color: "#000",
  },
  sudokuImage: {
    width: 50,
    height: 50,
    marginTop: 4,
  },
    gameTitle: {
    color: "#FFF",
    fontWeight: "700",
    fontSize: 12,
    marginBottom: 6,
  },
  gameDetail: {
    color: "#DDD",
    fontSize: 12,
    marginBottom: 3,
  },
    emptyGamesContainer: {
    backgroundColor: "rgba(30, 30, 40, 0.6)",
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 150,
  },
  emptyGamesText: {
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: 16,
    fontWeight: "500",
    marginVertical: 10,
  },
    gamesScrollContainer: {
    paddingBottom: 10,
  },
  gamesGrid: {
    flexDirection: "row",
    paddingRight: 20,
  },
  // gameCard: {
  //   backgroundColor: "rgba(50, 50, 60, 0.7)",
  //   borderRadius: 15,
  //   padding: 12,
  //   width: 130,
  //   marginRight: 12,
  //   alignItems: "center",
  //   borderWidth: 1,
  //   borderColor: "rgba(255, 255, 255, 0.1)",
  //   height: 130,
  // },
  sudokuGameCard: {
    borderColor: "rgba(255, 215, 0, 0.3)",
    backgroundColor: "rgba(60, 60, 70, 0.8)",
    width: 140,
    height: 160,
  },
    gamesSection: {
    marginBottom: 20,
  },
  gamesSectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },
    memberName: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "500",
    textAlign: "center",
    textShadowColor: "rgba(0, 0, 0, 0.3)",
    textShadowOffset: { width: 0.5, height: 0.5 },
    textShadowRadius: 1,
  },
  coinText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 6,
  },
  coinEmoji: {
    fontSize: 18,
    marginLeft: 4,
  },
challengeCard: {
  backgroundColor: 'rgba(255, 255, 255, 0.15)',
  borderRadius: 18,
  padding: 20,
  marginBottom: 25,
  borderWidth: 1,
  borderColor: 'rgba(255, 255, 255, 0.25)',
  alignItems: 'center',
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 3 },
  shadowOpacity: 0.25,
  shadowRadius: 5,
},
challengeDetailsRow: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  width: '100%',
  marginTop: 6,
},
challengeDateText: {
  color: '#FFF',
  fontSize: 13,
  fontStyle: 'italic',
  opacity: 0.9,
},
feeRow: {
  marginTop: 10,
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
},
coinValue: {
  fontSize: 16,
  fontWeight: '600',
  color: '#FFD700',
  marginLeft: 6,
},

section: {
  marginBottom: 25,
  alignItems: 'center',
},
daysScroll: {
  flexDirection: 'row',
  gap: 10,
  paddingVertical: 10,
},
dayBubble: {
  width: 44,
  height: 44,
  borderRadius: 22,
  backgroundColor: 'rgba(255, 255, 255, 0.15)',
  justifyContent: 'center',
  alignItems: 'center',
},
dayBubbleActive: {
  backgroundColor: '#FFD700',
},
dayBubbleText: {
  color: '#FFF',
  fontWeight: '600',
},
dayBubbleTextActive: {
  color: '#000',
},

gameCard: {
  backgroundColor: 'rgba(255,255,255,0.12)',
  borderRadius: 16,
  padding: 14,
  marginHorizontal: 8,
  alignItems: 'center',
  width: 140,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.3,
  shadowRadius: 4,
},
gameImage: {
  width: 60,
  height: 60,
  marginTop: 6,
},

chartWrapper: {
  backgroundColor: 'rgba(255,255,255,0.1)',
  borderRadius: 16,
  padding: 10,
  borderWidth: 1,
  borderColor: 'rgba(255,255,255,0.25)',
  alignSelf: 'center',
},
disabledCell: {
  opacity: 0.4, // visually dimmed
  backgroundColor: '#f0f0f0', // light gray background
},
  infoBtn: {
    marginLeft: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoIcon: {

    textShadowColor: 'rgba(0, 0, 0, 0.30)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  infoBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  infoCard: {
    width: '90%',
    backgroundColor: 'rgba(40, 40, 48, 0.65)',
    borderRadius: 26,
    padding: 23,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  infoTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
  },
  infoText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
  },
  infoClose: {
    alignSelf: 'flex-end',
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 8,
  },
  infoCloseText: {
    color: '#FFF',
    fontWeight: '700',
  },
formSection2: {
  flexDirection: "row",
  alignItems: "center",
  paddingVertical: 4,
  paddingHorizontal: 2,
},
});

export default EditAvailability;
