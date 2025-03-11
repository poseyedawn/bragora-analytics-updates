"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/hooks/useAuth";
import { Button } from "@/components/ui/button";
import FeatherIcon from "feather-icons-react";
import { supabase } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/use-toast";

interface AnalyticsData {
  totalAchievements: number;
  totalDailyWins: number;
  consistency: number;
  achievementsByCategory: { category: string; count: number }[];
  monthlyProgress: { month: string; count: number }[];
}

interface CareerInsight {
  isLoading: boolean;
  error: string | null;
  content: string | null;
}

export default function Analytics() {
  const { user, isLoading: authLoading } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData>({
    totalAchievements: 0,
    totalDailyWins: 0,
    consistency: 0,
    achievementsByCategory: [],
    monthlyProgress: [],
  });
  const [timeRange, setTimeRange] = useState("30days");
  const { toast } = useToast();
  const [insights, setInsights] = useState<CareerInsight>({
    isLoading: false,
    error: null,
    content: null,
  });
  const [profileData, setProfileData] = useState<{
    first_name: string | null;
    last_name: string | null;
    avatar_url: string | null;
  }>({
    first_name: null,
    last_name: null,
    avatar_url: null,
  });

  // Get greeting based on time of day
  const getGreeting = (): string => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 18) return "Good Afternoon";
    return "Good Evening";
  };

  // Fetch analytics data from Supabase
  useEffect(() => {
    if (user) {
      fetchAnalyticsData();
      fetchProfileData();
    } else if (!authLoading) {
      setIsLoading(false);
    }
  }, [user, timeRange, authLoading]);

  const fetchProfileData = async () => {
    try {
      if (!user?.id) return;
      
      const { data, error } = await supabase
        .from("profiles")
        .select("first_name, last_name, avatar_url")
        .eq("id", user.id)
        .single();
      
      if (error) throw error;
      
      if (data) {
        setProfileData({
          first_name: data.first_name,
          last_name: data.last_name,
          avatar_url: data.avatar_url,
        });
      }
    } catch (error) {
      console.error("Error fetching profile data:", error);
    }
  };

  const fetchAnalyticsData = async () => {
    try {
      setIsLoading(true);
      
      if (!user?.id) {
        setIsLoading(false);
        return;
      }
      
      console.log("Fetching analytics data for user:", user.id);
      
      // Get date range
      const now = new Date();
      let startDate = new Date();
      
      if (timeRange === "30days") {
        startDate.setDate(now.getDate() - 30);
      } else if (timeRange === "90days") {
        startDate.setDate(now.getDate() - 90);
      } else if (timeRange === "year") {
        startDate.setFullYear(now.getFullYear() - 1);
      }
      
      const startDateStr = startDate.toISOString();
      console.log("Date range:", startDateStr, "to", now.toISOString());
      
      // Fetch achievements count
      console.log("Fetching achievements count...");
      const achievementsResponse = await supabase
        .from("achievements")
        .select("*", { count: "exact" })
        .eq("user_id", user.id)
        .gte("created_at", startDateStr);
      
      if (achievementsResponse.error) {
        console.error("Error fetching achievements count:", achievementsResponse.error);
        throw achievementsResponse.error;
      }
      
      const achievementsCount = achievementsResponse.count || 0;
      console.log("Achievements count:", achievementsCount);
      
      // Fetch daily wins count
      console.log("Fetching daily wins count...");
      const dailyWinsResponse = await supabase
        .from("daily_wins")
        .select("*", { count: "exact" })
        .eq("user_id", user.id)
        .gte("created_at", startDateStr);
      
      if (dailyWinsResponse.error) {
        console.error("Error fetching daily wins count:", dailyWinsResponse.error);
        throw dailyWinsResponse.error;
      }
      
      const dailyWinsCount = dailyWinsResponse.count || 0;
      console.log("Daily wins count:", dailyWinsCount);
      
      // Fetch achievements by category
      console.log("Fetching achievements by category...");
      const { data: categoryData, error: categoryError } = await supabase
        .from("achievements")
        .select("category")
        .eq("user_id", user.id)
        .gte("created_at", startDateStr);
      
      if (categoryError) {
        console.error("Error fetching achievements by category:", categoryError);
        throw categoryError;
      }
      
      // Process category data
      const categoryCounts: Record<string, number> = {};
      categoryData.forEach(item => {
        const category = item.category || "Uncategorized";
        categoryCounts[category] = (categoryCounts[category] || 0) + 1;
      });
      
      const achievementsByCategory = Object.entries(categoryCounts).map(([category, count]) => ({
        category,
        count,
      })).sort((a, b) => b.count - a.count);
      
      console.log("Achievements by category:", achievementsByCategory);
      
      // Calculate consistency (percentage of days with at least one entry)
      const daysDiff = Math.max(1, Math.ceil((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
      
      // Fetch daily wins grouped by date
      console.log("Fetching daily wins by date...");
      const { data: dailyWinsByDate, error: dailyWinsByDateError } = await supabase
        .from("daily_wins")
        .select("created_at")
        .eq("user_id", user.id)
        .gte("created_at", startDateStr);
      
      if (dailyWinsByDateError) {
        console.error("Error fetching daily wins by date:", dailyWinsByDateError);
        throw dailyWinsByDateError;
      }
      
      // Count unique days with entries
      const uniqueDays = new Set();
      dailyWinsByDate.forEach(item => {
        const date = new Date(item.created_at).toDateString();
        uniqueDays.add(date);
      });
      
      const consistency = Math.round((uniqueDays.size / daysDiff) * 100);
      console.log("Consistency:", consistency, "% (", uniqueDays.size, "days out of", daysDiff, ")");
      
      // Generate monthly progress data
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const monthlyData: Record<string, number> = {};
      
      // Initialize with zero counts
      for (let i = 0; i < 3; i++) {
        const monthIndex = (now.getMonth() - i + 12) % 12;
        monthlyData[monthNames[monthIndex]] = 0;
      }
      
      // Fetch monthly achievements
      console.log("Fetching monthly achievements...");
      const { data: monthlyAchievements, error: monthlyError } = await supabase
        .from("achievements")
        .select("created_at")
        .eq("user_id", user.id)
        .gte("created_at", new Date(now.getFullYear(), now.getMonth() - 2, 1).toISOString());
      
      if (monthlyError) {
        console.error("Error fetching monthly achievements:", monthlyError);
        throw monthlyError;
      }
      
      // Count achievements by month
      monthlyAchievements.forEach(item => {
        const date = new Date(item.created_at);
        const month = monthNames[date.getMonth()];
        monthlyData[month] = (monthlyData[month] || 0) + 1;
      });
      
      const monthlyProgress = Object.entries(monthlyData)
        .map(([month, count]) => ({ month, count }))
        .reverse();
      
      console.log("Monthly progress:", monthlyProgress);
      
      // Set analytics data
      setAnalyticsData({
        totalAchievements: achievementsCount,
        totalDailyWins: dailyWinsCount,
        consistency: consistency || 0,
        achievementsByCategory,
        monthlyProgress,
      });
      
      console.log("Analytics data loaded successfully");
    } catch (error) {
      console.error("Error fetching analytics data:", error);
      toast({
        title: "Error",
        description: "Failed to load analytics data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleTimeRangeChange = (range: string) => {
    setTimeRange(range);
  };

  const fetchCareerInsights = async () => {
    try {
      setInsights(prev => ({ ...prev, isLoading: true, error: null }));
      
      if (!user?.id || analyticsData.achievementsByCategory.length === 0) {
        setInsights(prev => ({ 
          ...prev, 
          isLoading: false, 
          error: "Insufficient data to generate insights" 
        }));
        return;
      }
      
      // Prepare the data for the AI prompt
      const topCategories = analyticsData.achievementsByCategory.slice(0, 3).map(cat => cat.category).join(", ");
      const totalAchievements = analyticsData.totalAchievements;
      const consistency = analyticsData.consistency;
      
      // Create the AI prompt
      const prompt = `Based on the user's career data:
        - Top skill categories: ${topCategories}
        - Total achievements logged: ${totalAchievements}
        - Consistency score: ${consistency}%
        
        Provide 3-4 brief, actionable career insights and recommendations. Focus on:
        1. Career paths that align with their strengths
        2. Skills they should develop further
        3. Specific action items to improve their career trajectory
        
        Format each insight as a bullet point starting with "- " and make each one clear, specific and concise. Keep each bullet point to 1-2 sentences maximum.`;
      
      // Call OpenAI API
      const response = await fetch('/api/openai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to generate career insights');
      }
      
      const reader = response.body?.getReader();
      let decoder = new TextDecoder();
      let result = '';
      
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          result += decoder.decode(value);
        }
      }
      
      setInsights({
        isLoading: false,
        error: null,
        content: result,
      });
    } catch (error) {
      console.error("Error generating career insights:", error);
      setInsights({
        isLoading: false,
        error: "Failed to generate career insights. Please try again.",
        content: null,
      });
    }
  };

  useEffect(() => {
    if (!isLoading && user && analyticsData.achievementsByCategory.length > 0 && !insights.content && !insights.isLoading) {
      fetchCareerInsights();
    }
  }, [isLoading, analyticsData, user]);

  if (authLoading || isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#74E043]"></div>
      </div>
    );
  }

  return (
    <div className="h-full">
      {/* Personalized Greeting Section */}
      <div className="bg-[#2E3033] rounded-xl p-6 mb-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
          <div className="flex-1">
            <h1 className="text-2xl font-medium text-white mb-1">
              {getGreeting()}, {profileData.first_name || user?.email?.split('@')[0] || 'User'}
            </h1>
            <p className="text-[#BCBCBC] text-sm">
              Here's what's happening today in your career analysis.
            </p>
          </div>
          
          <div className="flex items-center mt-4 md:mt-0">
            <div className="h-10 w-10 rounded-full bg-[#39393B] flex items-center justify-center overflow-hidden">
              {profileData.avatar_url ? (
                <img 
                  src={profileData.avatar_url} 
                  alt="Profile" 
                  className="h-full w-full object-cover"
                />
              ) : (
                <FeatherIcon icon="user" size={20} color="#BCBCBC" />
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Overview Metrics Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {/* Total Achievements Card */}
        <div className="bg-[#2E3033] rounded-xl p-5 hover:bg-[#39393B] transition-colors duration-200">
          <div className="flex justify-between items-start mb-4">
            <div className="text-[#BCBCBC] text-sm font-medium">Total Achievements</div>
            <div className="w-8 h-8 rounded-full bg-[#74E043]/10 flex items-center justify-center">
              <FeatherIcon icon="award" size={16} color="#74E043" />
            </div>
          </div>
          <div className="text-2xl font-semibold text-white">
            {analyticsData.totalAchievements}
          </div>
        </div>
        
        {/* Daily Wins Card */}
        <div className="bg-[#2E3033] rounded-xl p-5 hover:bg-[#39393B] transition-colors duration-200">
          <div className="flex justify-between items-start mb-4">
            <div className="text-[#BCBCBC] text-sm font-medium">Daily Wins</div>
            <div className="w-8 h-8 rounded-full bg-[#74E043]/10 flex items-center justify-center">
              <FeatherIcon icon="check-circle" size={16} color="#74E043" />
            </div>
          </div>
          <div className="text-2xl font-semibold text-white">
            {analyticsData.totalDailyWins}
          </div>
        </div>
        
        {/* Consistency Score Card */}
        <div className="bg-[#2E3033] rounded-xl p-5 hover:bg-[#39393B] transition-colors duration-200">
          <div className="flex justify-between items-start mb-4">
            <div className="text-[#BCBCBC] text-sm font-medium">Consistency Score</div>
            <div className="w-8 h-8 rounded-full bg-[#74E043]/10 flex items-center justify-center">
              <FeatherIcon icon="trending-up" size={16} color="#74E043" />
            </div>
          </div>
          <div className="text-2xl font-semibold text-white">
            {analyticsData.consistency}%
          </div>
        </div>
        
        {/* Top Category Card */}
        <div className="bg-[#2E3033] rounded-xl p-5 hover:bg-[#39393B] transition-colors duration-200">
          <div className="flex justify-between items-start mb-4">
            <div className="text-[#BCBCBC] text-sm font-medium">Top Category</div>
            <div className="w-8 h-8 rounded-full bg-[#74E043]/10 flex items-center justify-center">
              <FeatherIcon icon="bar-chart-2" size={16} color="#74E043" />
            </div>
          </div>
          <div className="text-2xl font-semibold text-white">
            {analyticsData.achievementsByCategory.length > 0 
              ? analyticsData.achievementsByCategory[0].category 
              : "No data"}
          </div>
        </div>
      </div>
    </div>
  );
}