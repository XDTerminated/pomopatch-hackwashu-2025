import { useEffect, useState } from "react";
import { useUser, useAuth } from "@clerk/clerk-react";
import App from "./App";
import { apiService, UserData, Plant } from "./api";

export default function GameWrapper() {
    const { user } = useUser();
    const { getToken } = useAuth();
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [userData, setUserData] = useState<UserData | null>(null);
    const [plants, setPlants] = useState<Plant[]>([]);

    useEffect(() => {
        const initializeUser = async () => {
            if (!user?.primaryEmailAddress?.emailAddress) {
                setError("No email found");
                setIsLoading(false);
                return;
            }

            try {
                const email = user.primaryEmailAddress.emailAddress;

                // Get the Clerk session token
                const authToken = await getToken();

                if (!authToken) {
                    setError("Failed to get authentication token");
                    setIsLoading(false);
                    return;
                }

                // Try to create the user (will return minimal data if already exists)
                await apiService.createUser(email, authToken);

                // Fetch user data (always fetch to get complete data)
                const userData = await apiService.getUser(email, authToken);
                setUserData(userData);

                // Fetch user's plants
                const plantsData = await apiService.getUserPlants(email, authToken);
                setPlants(plantsData);

                setIsLoading(false);
            } catch (err) {
                console.error("Error in user setup:", err);
                setError(err instanceof Error ? err.message : "Unknown error");
                setIsLoading(false);
            }
        };

        initializeUser();
    }, [user, getToken]);

    if (isLoading) {
        return (
            <div
                style={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    minHeight: "100vh",
                    backgroundColor: "#f5f5f5",
                }}
            >
                <div style={{ textAlign: "center" }}>
                    <p style={{ fontSize: "18px", color: "#333" }}>Loading your garden...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div
                style={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    minHeight: "100vh",
                    backgroundColor: "#f5f5f5",
                }}
            >
                <div style={{ textAlign: "center" }}>
                    <p style={{ fontSize: "18px", color: "#d32f2f" }}>Error: {error}</p>
                </div>
            </div>
        );
    }

    return <App initialMoney={userData?.money} initialPlantLimit={userData?.plant_limit} initialWeather={userData?.weather} initialPlants={plants} userEmail={user?.primaryEmailAddress?.emailAddress || ""} getAuthToken={getToken} />;
}
