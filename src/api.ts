// API Service for backend communication
const API_URL = "http://localhost:8000";

export interface UserData {
    email: string;
    username: string;
    money: number;
    plant_limit: number;
    weather: number;
}

export interface Plant {
    plant_id: number;
    plant_type: string;
    plant_species: string;
    size: number;
    rarity: number;
    x: number;
    y: number;
    stage: number;
    growth_time_remaining: number | null;
    fertilizer_remaining: number | null;
    email: string;
}

export interface CreatePlantRequest {
    plant_type: string;
    x: number;
    y: number;
}

export interface UpdatePositionRequest {
    x: number;
    y: number;
}

export interface GrowthTimeUpdate {
    time: number;
}

export interface MoneyChange {
    amount: number;
}

class APIService {
    private getAuthHeaders(token: string) {
        return {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        };
    }

    // User endpoints
    async createUser(email: string, token: string): Promise<UserData> {
        const response = await fetch(`${API_URL}/users/`, {
            method: "POST",
            headers: this.getAuthHeaders(token),
            body: JSON.stringify({ email }),
        });

        if (!response.ok) {
            // If user already exists (400), that's fine - we'll fetch their data instead
            if (response.status === 400) {
                const error = await response.json();
                if (error.detail?.includes("already exists")) {
                    // Return a minimal response, caller should fetch full user data
                    return { email, username: "", money: 0, plant_limit: 0, weather: 0 };
                }
            }
            const error = await response.json();
            throw new Error(error.detail || "Failed to create user");
        }

        return response.json();
    }

    async getUser(email: string, token: string): Promise<UserData> {
        const response = await fetch(`${API_URL}/users/${email}`, {
            headers: this.getAuthHeaders(token),
        });

        if (!response.ok) {
            throw new Error("Failed to fetch user data");
        }

        return response.json();
    }

    async updateUsername(email: string, newUsername: string, token: string) {
        const response = await fetch(`${API_URL}/users/${email}/username`, {
            method: "PATCH",
            headers: this.getAuthHeaders(token),
            body: JSON.stringify({ new_username: newUsername }),
        });

        if (!response.ok) {
            throw new Error("Failed to update username");
        }

        return response.json();
    }

    async changeMoney(email: string, amount: number, token: string) {
        const response = await fetch(`${API_URL}/users/${email}/money`, {
            method: "PATCH",
            headers: this.getAuthHeaders(token),
            body: JSON.stringify({ amount }),
        });

        if (!response.ok) {
            throw new Error("Failed to update money");
        }

        return response.json();
    }

    async increasePlantLimit(email: string, token: string) {
        const response = await fetch(`${API_URL}/users/${email}/increase-plant-limit`, {
            method: "POST",
            headers: this.getAuthHeaders(token),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || "Failed to increase plant limit");
        }

        return response.json();
    }

    async cycleWeather(email: string, token: string) {
        console.log("🌤️ API: Calling cycleWeather for", email);
        const response = await fetch(`${API_URL}/users/${email}/cycle-weather`, {
            method: "POST",
            headers: this.getAuthHeaders(token),
        });

        if (!response.ok) {
            const error = await response.json();
            console.error("🌤️ API: cycleWeather failed:", error);
            throw new Error(error.detail || "Failed to cycle weather");
        }

        const result = await response.json();
        console.log("🌤️ API: cycleWeather success:", result);
        return result;
    }

    async getUsers(token: string): Promise<UserData[]> {
        const response = await fetch(`${API_URL}/users`, {
            headers: this.getAuthHeaders(token),
        });

        if (!response.ok) {
            throw new Error("Failed to fetch users");
        }

        const data = await response.json();
        return data.users || [];
    }

    // Plant endpoints
    async getUserPlants(email: string, token: string): Promise<Plant[]> {
        const response = await fetch(`${API_URL}/users/${email}/plants`, {
            headers: this.getAuthHeaders(token),
        });

        if (!response.ok) {
            throw new Error("Failed to fetch plants");
        }

        const data = await response.json();
        return data.plants || [];
    }

    async createPlant(email: string, plantData: CreatePlantRequest, token: string) {
        const response = await fetch(`${API_URL}/users/${email}/plants/`, {
            method: "POST",
            headers: this.getAuthHeaders(token),
            body: JSON.stringify(plantData),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || "Failed to create plant");
        }

        return response.json();
    }

    async movePlant(email: string, plantId: number, position: UpdatePositionRequest, token: string) {
        const response = await fetch(`${API_URL}/users/${email}/plants/${plantId}/position`, {
            method: "PATCH",
            headers: this.getAuthHeaders(token),
            body: JSON.stringify(position),
        });

        if (!response.ok) {
            throw new Error("Failed to move plant");
        }

        return response.json();
    }

    async applyWater(email: string, plantId: number, token: string) {
        const response = await fetch(`${API_URL}/users/${email}/plants/${plantId}/apply-water`, {
            method: "PATCH",
            headers: this.getAuthHeaders(token),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || "Failed to apply water");
        }

        return response.json();
    }

    async applyFertilizer(email: string, plantId: number, token: string) {
        const response = await fetch(`${API_URL}/users/${email}/plants/${plantId}/apply-fertilizer`, {
            method: "PATCH",
            headers: this.getAuthHeaders(token),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || "Failed to apply fertilizer");
        }

        return response.json();
    }

    async growPlant(email: string, plantId: number, timeUpdate: GrowthTimeUpdate, token: string) {
        const response = await fetch(`${API_URL}/users/${email}/plants/${plantId}/grow`, {
            method: "PATCH",
            headers: this.getAuthHeaders(token),
            body: JSON.stringify(timeUpdate),
        });

        if (!response.ok) {
            throw new Error("Failed to grow plant");
        }

        return response.json();
    }

    async sellPlant(email: string, plantId: number, token: string) {
        const response = await fetch(`${API_URL}/users/${email}/plants/${plantId}/sell`, {
            method: "DELETE",
            headers: this.getAuthHeaders(token),
        });

        if (!response.ok) {
            throw new Error("Failed to sell plant");
        }

        return response.json();
    }
}

export const apiService = new APIService();
