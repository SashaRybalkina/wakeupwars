import React, { useEffect, useState, useMemo } from 'react';
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

const DAYS = ["M", "T", "W", "TH", "F", "S", "SU"];
// Zero-pad to match API format like "06:00"
const TIMES = Array.from({ length: 12 }, (_, i) => `${String(i + 6).padStart(2, '0')}:00`);

type Props = {
  navigation: NavigationProp<any>
}

type AvailabilityEntry = {
  uID: number;
  name: string;
  dayOfWeek: number;
  alarmTime: string; // may come as "HH:MM" or "HH:MM:SS"
};

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
  const { pendingChallengeId, pendingChallengeName, pendingChallengeEndDate } = route.params as { 
    pendingChallengeId: number, 
    pendingChallengeName: string, 
    pendingChallengeEndDate: string };

  const { user } = useUser();

  const [availability, setAvailability] = useState<AvailabilityEntry[]>([]);
  const [userAvailability, setUserAvailability] = useState<AvailabilityEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Assign a color to each user
  const userColorMap = useMemo(() => {
    const uniqueUserIds = [...new Set(availability.map(a => a.uID))];
    const colorMap: Record<number, string> = {};
    uniqueUserIds.forEach((id, index) => {
      colorMap[id] = transparentColors[index % transparentColors.length] || 'transparent';
      // console.log('color for', id, colorMap[id]);
    });
    return colorMap;
  }, [availability]);

  useEffect(() => {
    if (!user?.id) {
      console.error("userId is missing!");
      return;
    }

    const fetchAvailability = async () => {
      try {
        const res = await fetch(endpoints.getAvailabilities(pendingChallengeId));
        const data = await res.json();
        console.log('Availability:', data);
        setAvailability(data);
        setUserAvailability(
          data.filter((entry: AvailabilityEntry) => entry.uID === user.id)
        );
      } catch (error) {
        console.error("Error fetching availabilities:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchAvailability();
  }, [pendingChallengeId, user]);



const toggleCell = (dayIdx: number, timeIdx: number) => {
  const dayOfWeek = dayIdx + 1;
  const timeStr = TIMES[timeIdx];
  if (!timeStr || !user?.id || !user?.name) return;

  const cellKey = (entry: AvailabilityEntry) =>
    entry.dayOfWeek === dayOfWeek && toHHMM(entry.alarmTime) === timeStr;

  const isUserInCell = userAvailability.some(cellKey);
  const usersInCell = availability.filter(cellKey);

  if (!isUserInCell) {
    // Add user's availability
    const newEntry: AvailabilityEntry = {
      uID: Number(user.id),
      name: user.name,
      dayOfWeek,
      alarmTime: timeStr,
    };

    setUserAvailability(prev => [...prev, newEntry]);
    setAvailability(prev => [...prev, newEntry]);

  } else {
    // User is in the slot, remove them
    setUserAvailability(prev =>
      prev.filter(entry => !(entry.dayOfWeek === dayOfWeek && toHHMM(entry.alarmTime) === timeStr))
    );
    setAvailability(prev =>
      prev.filter(entry => !(entry.uID === user.id && entry.dayOfWeek === dayOfWeek && toHHMM(entry.alarmTime) === timeStr))
    );
  }
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

  const handleSubmit = async () => {

      // Ensure we submit zero-padded "HH:MM"
      const payload = userAvailability.map(({ dayOfWeek, alarmTime }) => ({
        dayOfWeek,
        alarmTime: toHHMM(alarmTime),
      }));

        try {
            const csrfRes = await fetch(`${BASE_URL}/api/csrf-token/`, {
                credentials: 'include',                      
        });
        if (!csrfRes.ok) throw new Error('Failed to fetch CSRF token');
        const { csrfToken } = await csrfRes.json();   

      const res = await fetch(endpoints.setUserAvailability(Number(user?.id), pendingChallengeId), {
        method: 'POST',
        credentials: 'include',                    
        headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': csrfToken,                
        },
        body: JSON.stringify({ availability: payload }),
      });

      if (!res.ok) throw new Error('Failed to update availability.');

      Alert.alert('Success', 'Your availability was saved.');
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  };


    const handleDecline = async () => {
        try {
            const csrfRes = await fetch(`${BASE_URL}/api/csrf-token/`, {
                credentials: 'include',                      
        });
        if (!csrfRes.ok) throw new Error('Failed to fetch CSRF token');
        const { csrfToken } = await csrfRes.json();   

      const res = await fetch(endpoints.declineChallengeInvite(Number(user?.id), pendingChallengeId), {
        method: 'POST',
        credentials: 'include',                    
        headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': csrfToken,                
        },
      });

      if (!res.ok) throw new Error('Failed to decline invite.');

      Alert.alert('Success', 'Invite declined.');
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  };

return (
  <ImageBackground
    source={require('../../images/cgpt.png')}
    style={styles.background}
    resizeMode="cover"
  >
    <ScrollView
      contentContainerStyle={styles.scrollContentContainer}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.challengeInfoContainer}>
        <Text style={styles.challengeTitle}>{pendingChallengeName}</Text>
        <Text style={styles.challengeEndDate}>Ends: {pendingChallengeEndDate}</Text>
      </View>

      <Text style={styles.title}>Edit Your Availability</Text>

      {loading ? (
        <ActivityIndicator size="large" color="#FFD700" />
      ) : (
        <View style={styles.formSection}>
          <Text style={styles.sectionLabel}>Select Availability</Text>
          <ScrollView horizontal>
            <View style={styles.grid}>
              <View style={styles.row}>
                <View style={styles.cell} />
                {DAYS.map((day, idx) => (
                  <View key={idx} style={styles.cell}>
                    <Text style={styles.headerText}>{day}</Text>
                  </View>
                ))}
              </View>

              {TIMES.map((time, timeIdx) => (
                <View key={timeIdx} style={styles.row}>
                  <View style={styles.cell}>
                    <Text style={styles.headerText}>{time}</Text>
                  </View>

{DAYS.map((_, dayIdx) => {
  const users = getUsersInSlot(dayIdx, timeIdx);
  const isUserHere = users.some(u => u.uID === user?.id);

  return (
    <TouchableOpacity
      key={`${dayIdx}-${timeIdx}`}
      style={[
        styles.cell,
        styles.interactiveCell,
      ]}
      onPress={() => toggleCell(dayIdx, timeIdx)}
    >
      {users.length > 0 && (
        <View pointerEvents="none" style={styles.stripeOverlay}>
          {users.map((u, i) => (
            <View
              key={i}
              style={{
                flex: 1,
                backgroundColor: userColorMap[u.uID] || 'rgba(255,255,255,0.2)',
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
            </View>
          </ScrollView>
        </View>
      )}

      {!loading && availability.length > 0 && (() => {
        const nameMap = new Map(availability.map(({ uID, name }) => [uID, name]));
        return (
          <View style={styles.legendContainer}>
            {Array.from(nameMap.entries()).map(([id, name]) => (
              <View key={id} style={styles.legendItem}>
                <View style={[styles.legendColor, { backgroundColor: userColorMap[id] }]} />
                <Text style={styles.legendText}>{name}</Text>
              </View>
            ))}
          </View>
        );
      })()}

      <TouchableOpacity style={styles.saveButton} onPress={handleSubmit}>
        <Text style={styles.saveButtonText}>Save My Availability</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.saveButton} onPress={handleDecline}>
        <Text style={styles.saveButtonText}>Decline Challenge Invite</Text>
      </TouchableOpacity>
    </ScrollView>
  </ImageBackground>
);

};

const styles = StyleSheet.create({
  background: {
    flex: 1,
  },
  scrollContentContainer: {
  paddingTop: 50,
  paddingHorizontal: 12,
  paddingBottom: 100, // give room for last button
},
//   container: {
//     flex: 1,
//     paddingTop: 50,
//     paddingHorizontal: 12,
//   },
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
    width: 50,
    height: 40,
    borderWidth: 1,
    borderColor: '#ffffffd1',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  headerText: {
    color: '#FFF',
    fontSize: 12,
    textAlign: 'center',
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
  backgroundColor: "rgba(255, 255, 255, 0.25)",
  borderRadius: 16,
  padding: 16,
  marginBottom: 20,
  borderWidth: 1,
  borderColor: "rgba(255, 255, 255, 0.3)",
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


});

export default EditAvailability;
