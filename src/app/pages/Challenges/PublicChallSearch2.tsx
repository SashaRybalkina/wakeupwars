import { StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { NavigationProp, useLinkBuilder, useRoute } from '@react-navigation/native';
import PendingPublicChallengeCard from "./PendingPublicChallengeCard"

type Props = { navigation: NavigationProp<any> } 

interface ChallengeMatch {
  summary: {
    id: number;
    name: string;
    startDate: string;
    endDate: string;
    totalDays: number;
    daysOfWeek: string[]; 
    numParticipants: number;
  };
  distance: number;
  averageSkillLevel: number;
}

const PublicChallSearch2: React.FC<Props> = ({ navigation }) => {
  const route = useRoute();
  const { matches } = route.params as {
    matches: ChallengeMatch[]
  };

  return (
    <ScrollView style={{ padding: 10 }}>
      {matches.map((m: any) => (
        <TouchableOpacity
            onPress={() =>
            navigation.navigate("ChallSchedule", {
                challId: m.summary.id,
                challName: m.summary.name,
            })
            }
            style={styles.challengeContainer}
            >
                
            <PendingPublicChallengeCard
                title={m.summary.name}
                icon={require("../../images/school.png")} // placeholder icon
                numEnrolledMembers={m.summary.numParticipants}
                totalDays={m.summary.totalDays}
                daysOfWeek={m.summary.daysOfWeek}
            />
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  background: {
    flex: 1,
    paddingTop: 50,
  },
  headerContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
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
  titleContainer: {
    marginTop: 10,
    paddingLeft: 10,
  },
  title: {
    color: "#FFF",
    fontSize: 38,
    fontWeight: "800",
    textShadowColor: "rgba(0, 0, 0, 0.2)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  titleSecondary: {
    color: "#FFF",
    fontSize: 38,
    fontWeight: "800",
    marginTop: -5,
    textShadowColor: "rgba(0, 0, 0, 0.2)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  decorativeLine: {
    width: 60,
    height: 4,
    backgroundColor: "#FFD700",
    borderRadius: 2,
    marginTop: 10,
    marginBottom: 10,
  },
  scrollViewContainer: {
    flex: 1,
    paddingHorizontal: 30,
  },
  scrollViewContent: {
    paddingBottom: 100,
  },
  challengeContainer: {
    marginBottom: 15,
    borderRadius: 16,
    overflow: "hidden",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    width: "100%",
    alignSelf: "center",
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingBottom: 100,
  },
  emptyStateText: {
    color: "#FFF",
    fontSize: 24,
    fontWeight: "600",
    marginTop: 20,
  },
  emptyStateSubText: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 16,
    marginTop: 10,
  },
  navBar: {
    backgroundColor: "#211F26",
    flexDirection: "row",
    height: 80,
    justifyContent: "space-around",
    alignItems: "center",
    paddingBottom: 15,
  },
  navButton: {
    justifyContent: "center",
    alignItems: "center",
    flex: 1,
  },
  navText: {
    color: "#999",
    fontSize: 12,
    marginTop: 4,
  },
  activeNavText: {
    color: "#FFD700",
    fontSize: 12,
    marginTop: 4,
    fontWeight: "600",
  },
    addNewButton: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignSelf: "center",
    marginTop: 30,
    marginBottom: 5,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.3)",
  },
  addNewButtonText: {
    color: "#000",
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
})

export default PublicChallSearch2
