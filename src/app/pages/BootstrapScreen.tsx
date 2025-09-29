import React, { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { getAccessToken } from "../auth";
import { useUser } from "../context/UserContext";
import { BASE_URL, endpoints } from '../api';

const BootstrapScreen = ({ navigation, route }: any) => {
  const { setUser } = useUser();

  useEffect(() => {
    console.log("in bootstrap")
    const bootstrap = async () => {
      const token = await getAccessToken();

      if (token) {
        // Fetch user info
        const response = await fetch(endpoints.login, {
            method: "GET",
            headers: { Authorization: `Bearer ${token}` },
        });

        const data = await response.json();
        console.log(data)

        // Step 3: Check response
        if (response.ok && data.success) {
            setUser({
            id: data.id,
            name: data.name,
            email: data.email,
            username: data.username,
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
