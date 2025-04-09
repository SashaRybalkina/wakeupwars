import React, { useState } from 'react';
import { ImageBackground, StyleSheet, Text, View } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useRoute } from '@react-navigation/native';

const Chall4 = ({ navigation }) => {
  const route = useRoute();
  const { game, onGameSelected } = route.params || {};

  const donePressed = () => {
    if (onGameSelected) {
      // Ensure that digitValue and minuteValue are numbers, not strings
      onGameSelected(game, [digitValue + '', minuteValue + '']);
    }
    navigation.navigate('GroupChall2');
  };

  const [digitValue, setDigitValue] = useState(1);
  const [minuteValue, setMinuteValue] = useState(1);

  return (
    <ImageBackground
      source={require('../../images/tertiary.png')}
      style={styles.background}
      resizeMode="cover"
    >
      <View style={styles.backButtonContainer}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={30} color="#FFF" />
        </TouchableOpacity>
      </View>
      <Text style={styles.title}>{game}</Text>

      <View style={styles.container}>
        <Text style={styles.pickerLabel}>How many times?</Text>
        <View style={styles.pickerWrapper}>
          <Picker
            selectedValue={digitValue}
            style={styles.picker}
            onValueChange={(itemValue) => setDigitValue(itemValue)}
          >
            {[...Array(10).keys()].map((index) => (
              <Picker.Item
                key={index}
                label={`${index + 1}`}
                value={`${index + 1}`}
                color="#fff"
              />
            ))}
          </Picker>
        </View>

        <Text style={styles.pickerLabel}>Time Gap?</Text>
        <View style={styles.pickerWrapper}>
          <Picker
            selectedValue={minuteValue}
            style={styles.picker}
            onValueChange={(itemValue) => setMinuteValue(itemValue)}
          >
            {[...Array(10).keys()].map((index) => (
              <Picker.Item
                key={index}
                label={`${index + 1}`}
                value={`${index + 1}`}
                color="#fff"
              />
            ))}
          </Picker>
        </View>
      </View>

      <Text style={styles.doneButton} onPress={donePressed}>
        Done
      </Text>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  background: {
    flex: 1,
    alignItems: 'center',
  },
  backButtonContainer: {
    position: 'absolute',
    top: 50,
    left: 20,
    zIndex: 10,
  },
  title: {
    fontSize: 35,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 150,
    marginBottom: 30,
  },
  container: {
    alignItems: 'center',
  },
  pickerLabel: {
    fontSize: 25,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 35,
  },
  pickerWrapper: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 10,
    overflow: 'hidden',
    marginVertical: 25,
    width: 200,
  },
  picker: {
    height: 100,
    width: 200,
    backgroundColor: 'transparent', // Make the background transparent for the picker itself
    justifyContent: 'center',
  },
  doneButton: {
    textAlign: 'center',
    fontSize: 20,
    color: '#fff',
    fontWeight: 'bold',
    marginTop: 20,
    paddingVertical: 12.5,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 10,
    width: 150,
    height: 50,
  },
});

export default Chall4;
