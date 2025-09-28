import React, { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { getAccessToken } from "../auth";
import { useUser } from "../context/UserContext";
import { BASE_URL, endpoints } from '../api';

const BootstrapScreen = ({ navigation, route }: any) => {
  const { setUser } = useUser();

  useEffect(() => {
    const bootstrap = async () => {
      const token = await getAccessToken();

      if (token) {
        // Fetch user info
        const res = await fetch(endpoints.getUserInfo, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.ok) {
          const userData = await res.json();
          setUser({
            id: userData.id,
            name: userData.name,
            email: userData.email,
            username: userData.username,
          });

          // Navigate to the intended screen if provided via route.params
          if (route.params?.screen) {
            navigation.replace(route.params.screen, route.params.data || {});
          } else {
            navigation.replace("Profile");
          }
        } else {
          navigation.replace("Login");
        }
      } else {
        navigation.replace("Login");
      }
    };

    bootstrap();
  }, []);

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <ActivityIndicator size="large" />
    </View>
  );
};

export default BootstrapScreen;
