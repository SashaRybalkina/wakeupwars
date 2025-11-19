import type React from "react"
import { View, Text, Image, StyleSheet, TouchableOpacity, type ImageSourcePropType } from "react-native"
import { LinearGradient } from "expo-linear-gradient"

interface PendingChallengeActionCardProps {
  title: string
  icon: ImageSourcePropType
  onAccept?: () => void
  onDecline?: () => void
  onPress?: () => void
}

const PendingChallengeActionCard: React.FC<PendingChallengeActionCardProps> = ({
  title,
  icon,
  onAccept,
  onDecline,
  onPress,
}) => {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
      <LinearGradient colors={["#FFFFFF", "#F8F9FE"]} style={styles.container}>
        <View style={styles.contentContainer}>
          <View style={styles.iconContainer}>
            <Image source={icon} style={styles.icon} />
          </View>

          <View style={styles.detailsContainer}>
            <Text style={styles.title}>{title}</Text>

            <View style={styles.actionsContainer}>
              <TouchableOpacity style={styles.acceptButton} onPress={onAccept}>
                <Text style={styles.acceptText}>Accept</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.declineButton} onPress={onDecline}>
                <Text style={styles.declineText}>Decline</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    overflow: "hidden",
    padding: 14,
    marginBottom: 10,
  },
  contentContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconContainer: {
    width: 85,
    height: 85,
    borderRadius: 40,
    borderColor: 'rgba(251, 174, 51, 0.5)',
    borderWidth: 4,
    backgroundColor: "#D1C4E9",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  icon: {
    width: 80,
    height: 80,
    resizeMode: "cover",
  },
  detailsContainer: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#333",
    marginBottom: 8,
  },
  actionsContainer: {
    flexDirection: "row",
    marginTop: 6,
  },
  acceptButton: {
    backgroundColor: "#4CAF50",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginRight: 10,
  },
  declineButton: {
    backgroundColor: "#FF3B30",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  acceptText: {
    color: "#fff",
    fontWeight: "600",
  },
  declineText: {
    color: "#fff",
    fontWeight: "600",
  },
})

export default PendingChallengeActionCard
