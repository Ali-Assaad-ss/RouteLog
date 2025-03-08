import React, { useState, useEffect, CSSProperties } from "react";
import { format, parseISO } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import api from "@/api";
import eldimage from "@/assets/logimage.jpg";
import { useParams } from "react-router-dom";
interface Log {
  status: "OFF" | "D" | "ON" | "SB";
  start_time: string;
  end_time: string;
  notes?: string;
  location?: {
    name: string;
    lat: number;
    lon: number;
  };
}

interface ProcessedLog extends Log {
  isStationary?: boolean;
}

interface TransitionLog {
  isTransition: true;
  from: "OFF" | "D" | "ON" | "SB";
  to: "OFF" | "D" | "ON" | "SB";
  time: string;
  end_time: string;
  location: {
    lat: number;
    lon: number;
    name: string;
  };
  activity: string;
}

interface DailySummary {
  date: string;
  miles: number;
  drive_hours: number;
  on_duty_hours: number;
  logs: Log[];
}

interface TripData {
  trip_id: string;
  daily_summaries: DailySummary[];
}

interface StatusTotals {
  OFF: string;
  D: string;
  ON: string;
  SB: string;
}

interface EldOverlayProps {
  dayData: DailySummary;
}
const handleReverseGeocode = async (position: any) => {
  try {
    const response = await api.get(
      `/api/reverse-geocode/?lat=${position[1]}&lon=${position[0]}`
    );
    return response.data;
  } catch (err) {
    console.error(err);
    return null;
  }
};

const EldLogOverlay: React.FC = () => {
  const { tripId } = useParams<{ tripId: string }>();
  const [tripData, setTripData] = useState<TripData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [currentDayIndex, setCurrentDayIndex] = useState<number>(0);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await api.get(`/api/trip-details/${tripId}/`);
        const data = response.data;
        setTripData(data);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [tripId]);

  if (loading)
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-xl">Loading ELD log data...</div>
      </div>
    );

  if (error)
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-xl text-red-500">Error: {error}</div>
      </div>
    );

  if (!tripData) return null;

  const currentDay = tripData.daily_summaries[currentDayIndex];

  const handlePrevDay = () => {
    if (currentDayIndex > 0) {
      setCurrentDayIndex(currentDayIndex - 1);
    }
  };

  const handleNextDay = () => {
    if (currentDayIndex < tripData.daily_summaries.length - 1) {
      setCurrentDayIndex(currentDayIndex + 1);
    }
  };

  const handleDaySelect = (value: string) => {
    setCurrentDayIndex(parseInt(value));
  };

  return (
    <div className="w-full min-h-screen bg-gray-100">
      <div className="w-full mx-auto p-[4vw]">
        <Card className="w-full mb-4">
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Trip #{tripData.trip_id} ELD Log</CardTitle>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handlePrevDay}
                  disabled={currentDayIndex === 0}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>

                <Select
                  value={currentDayIndex.toString()}
                  onValueChange={handleDaySelect}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Select day" />
                  </SelectTrigger>
                  <SelectContent>
                    {tripData.daily_summaries.map((day, index) => (
                      <SelectItem key={day.date} value={index.toString()}>
                        {day.date}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleNextDay}
                  disabled={
                    currentDayIndex === tripData.daily_summaries.length - 1
                  }
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <CardDescription>
              Date: {currentDay.date} | Miles: {currentDay.miles.toFixed(2)} |
              Drive: {currentDay.drive_hours.toFixed(2)} hrs | On Duty:{" "}
              {currentDay.on_duty_hours.toFixed(2)} hrs
            </CardDescription>
          </CardHeader>
        </Card>

        <div className="relative w-full">
          <img src={eldimage} alt="ELD Log Form" className="w-full h-auto" />
          <EldOverlay dayData={currentDay} />
        </div>
      </div>
    </div>
  );
};

const EldOverlay: React.FC<EldOverlayProps> = ({ dayData }) => {
  const [processedLogs, setProcessedLogs] = useState<
    (ProcessedLog | TransitionLog)[]
  >([]);
  const [user, setUser] = useState<any>({});
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {}, []);

  useEffect(() => {
    const processLogs = async () => {
      setLoading(true);

      const fetchUser = async () => {
        api.get("/api/user/").then((res) => {
          setUser(res.data);
        });
      };
      fetchUser();
      if (!dayData) return;

      const processed = await Promise.all(
        dayData.logs.flatMap(async (currentLog, i, logs) => {
          const nextLog = logs[i + 1];
          const isStationary = ["fueling", "break", "pickup", "drop off"].some(
            (activity) => currentLog.notes?.toLowerCase().includes(activity)
          );

          let logEntries: (ProcessedLog | TransitionLog)[] = [
            { ...currentLog, isStationary },
          ];

          if (nextLog && currentLog.status !== nextLog.status) {
            const location = currentLog.location || {
              lat: 0,
              lon: 0,
              name: "",
            };
            if (location.lat && location.lon) {
              const locationData = await handleReverseGeocode([
                location.lon,
                location.lat,
              ]);
              location.name = locationData?.name || "";
            }

            logEntries.push({
              isTransition: true,
              from: currentLog.status,
              to: nextLog.status,
              time: nextLog.start_time,
              end_time: nextLog.end_time,
              location: location,
              activity: nextLog.notes || "",
            });
          }

          return logEntries;
        })
      );

      // Flatten the array of arrays
      setProcessedLogs(processed.flat());
      setLoading(false);
    };

    processLogs();
  }, [dayData]);
  if (loading) return null;
  if (!dayData) return null;

  const getTimePosition = (timeString: string) => {
    const date = new Date(timeString);
    return ((date.getHours() + date.getMinutes() / 60) / 24) * 70.6 + 16.66;
  };

  const calculateStatusTotals = (): StatusTotals => {
    const totals: Record<string, number> = {
      OFF: 0,
      D: 0,
      ON: 0,
      SB: 0,
    };

    dayData.logs.forEach((log) => {
      const start = parseISO(log.start_time);
      const end = parseISO(log.end_time);
      const diffMs = end.getTime() - start.getTime();
      const minutes = Math.round(diffMs / (1000 * 60));
      totals[log.status] += minutes;
    });

    Object.keys(totals).forEach((key) => {
      if (totals[key] % 10 === 1 || totals[key] % 10 === 2) {
        totals[key] -= totals[key] % 10;
      }
      if (totals[key] % 10 === 9 || totals[key] % 10 === 8) {
        totals[key] += 10 - (totals[key] % 10);
      }
    });
    console.log(totals);

    const formattedTotals: Record<string, string> = {};
    Object.keys(totals).forEach((key) => {
      const hours = Math.floor(totals[key] / 60);
      const minutes = totals[key] % 60;
      formattedTotals[key] = `${hours}h ${minutes}m`;
    });

    return formattedTotals as unknown as StatusTotals;
  };

  const statusRowPositions: Record<string, number> = {
    OFF: 44.3,
    D: 52.2,
    ON: 56.6,
    SB: 48.8,
  };

  const formFields: Record<string, { top: string; left: string }> = {
    driverName: { top: "10%", left: "20%" },
    coDriverName: { top: "32.5%", left: "82%" },
    date: { top: "10%", left: "44%" },
    totalMiles: { top: "19.8%", left: "29%" },
    totalDrivingMiles: { top: "19.8%", left: "15.5%" },
    startLocation: { top: "70%", left: "20%" },
    endLocation: { top: "75%", left: "20%" },
    vehicleId: { top: "70%", left: "60%" },
    carrier: { top: "16.5%", left: "60%" },
    fullname: { top: "32.5%", left: "50%" },
    homeAddress: { top: "26%", left: "62%" },
    officeAddress: { top: "21.3%", left: "62%" },
  };

  const statusTotals = calculateStatusTotals();
  const TOTALHOURSSTYLE: CSSProperties = {
    right: "5%",
    fontSize: "1.4vw",
    textAlign: "left",
    whiteSpace: "nowrap",
    display: "inline-block",
    width: "6vw",
  };

  return (
    <div className="absolute inset-0 pointer-events-none">
      <div
        className="absolute text-responsive"
        style={{
          ...formFields.date,
          fontSize: "2vw",
        }}
      >
        <span className="whitespace-pre">
          {format(parseISO(dayData.date), "MM      dd      yyyy")}
        </span>
      </div>

      <div
        className="absolute text-responsive"
        style={{
          ...formFields.totalMiles,
          fontSize: "1.5vw",
        }}
      >
        <span className="font-medium">{dayData.miles.toFixed(1)}</span>
      </div>
      <div
        className="absolute text-responsive"
        style={{
          ...formFields.totalDrivingMiles,
          fontSize: "1.5vw",
        }}
      >
        <span className="font-medium">{dayData.miles.toFixed(1)}</span>
      </div>

      <div
        className="absolute text-responsive"
        style={{
          ...formFields.fullname,
          fontSize: "1.5vw",
        }}
      >
        <span className="font-medium">{user.fullname}</span>
      </div>
      <div
        className="absolute text-responsive"
        style={{
          ...formFields.coDriverName,
          fontSize: "1.5vw",
        }}
      >
        <span className="font-medium">N/A</span>
      </div>
      <div
        className="absolute text-responsive"
        style={{
          ...formFields.officeAddress,
          fontSize: "1.5vw",
        }}
      >
        <span className="font-medium">{user.office_address}</span>
      </div>
      <div
        className="absolute text-responsive"
        style={{
          ...formFields.homeAddress,
          fontSize: "1.5vw",
        }}
      >
        <span className="font-medium">{user.home_address}</span>
      </div>
      <div
        className="absolute text-responsive"
        style={{
          ...formFields.carrier,
          fontSize: "1.5vw",
        }}
      >
        <span className="font-medium">{user.carrier}</span>
      </div>
      <div
        className="absolute text-responsive border-amber-700 border-[0.3vw] rounded-full w-[4vw] h-[4vw] flex"
        style={{
          alignItems: "center", // Vertically center items
          justifyContent: "center",
          top: "74%",
          left: "85%",

          fontSize: "1.5vw",
        }}
      >
        <span className="font-medium">{dayData.on_duty_hours}</span>
      </div>

      <div className="absolute top-[42%]" style={TOTALHOURSSTYLE}>
        {statusTotals.OFF}
      </div>

      <div className="absolute top-[47%]" style={TOTALHOURSSTYLE}>
        {statusTotals.SB}
      </div>

      <div className="absolute top-[51.5%]" style={TOTALHOURSSTYLE}>
        {statusTotals.D}
      </div>

      <div className="absolute top-[56%]" style={TOTALHOURSSTYLE}>
        {statusTotals.ON}
      </div>

      <div className="absolute top-[63%]" style={TOTALHOURSSTYLE}>
        24h 0m
      </div>

      {dayData.logs.map((log, index) => {
        const startPos = getTimePosition(log.start_time);
        const endPos = getTimePosition(log.end_time);
        const rowPos = statusRowPositions[log.status];
        console.log(log, startPos, endPos, rowPos);

        return (
          <React.Fragment key={`log-${index}`}>
            <div
              className="absolute border-t-[0.2vw] border-gray-500"
              style={{
                left: `${startPos}%`,
                width: `${endPos - startPos + 0.2}%`,
                top: `${rowPos}%`,
              }}
            />
          </React.Fragment>
        );
      })}

      {processedLogs
        .filter(
          (log): log is TransitionLog =>
            "isTransition" in log && log.isTransition
        )
        .map((transition, index) => {
          let position = getTimePosition(transition.time);
          const endPosition = getTimePosition(transition.end_time);
          const fromY = statusRowPositions[transition.from];
          const toY = statusRowPositions[transition.to];
          const minY = Math.min(fromY, toY);
          const maxY = Math.max(fromY, toY);

          return (
            <React.Fragment key={`transition-${index}`}>
              <div
                className="absolute border-l-[0.2vw] border-gray-500"
                style={{
                  left: `${position}%`,
                  top: `${minY}%`,
                  height: `${maxY - minY}%`,
                  zIndex: 10,
                }}
              />

              {transition.to !=="D" &&(
                  <div>
                    <div
                      className="absolute"
                      style={{
                        right: `${100 - position}%`,
                        bottom: `28%`,
                        height: "8vh",
                        width: "0.1vw",
                        background: "#888",
                      }}
                    ></div>
                    {transition.to !== "OFF" && transition.to !== "SB"  && (
                      <>
                        <div
                          className="absolute"
                          style={{
                            right: `${100 - endPosition}%`,
                            bottom: `28%`,
                            height: "0.1vw",
                            width: `${endPosition - position }%`,
                            background: "#888",
                          }}
                        ></div>
                        <div
                          className="absolute"
                          style={{
                            right: `${100 - endPosition}%`,
                            bottom: `28%`,
                            height: "8vh",
                            width: "0.1vw",
                            background: "#888",
                          }}
                        ></div>
                      </>
                    )}

                    <div
                      className="absolute"
                      style={{
                        right: `${100 - position}%`,
                        bottom: `28%`,
                        width: "15vw",
                        height: "0.1vw",
                        background: "#888",
                        transform: "rotate(-45deg)",
                        transformOrigin: "bottom right",
                      }}
                    ></div>
                    <div
                      className="absolute text-xs italic"
                      style={{
                        right: `${100 - position}%`,
                        bottom: `28%`,
                        fontSize: "0.8vw",
                        maxWidth: "20%",
                        transform: "rotate(-45deg)",
                        transformOrigin: "bottom right",
                        whiteSpace: "nowrap",
                        textAlign: "left",
                        width: "15vw",
                      }}
                    >
                      {transition.location.name}
                    </div>
                    <div
                      className="absolute text-xs italic"
                      style={{
                        right: `${98.7 - position}%`,
                        bottom: `28%`,
                        fontSize: "0.8vw",
                        maxWidth: "20%",
                        transform: "rotate(-45deg)",
                        transformOrigin: "bottom right",
                        whiteSpace: "pre-wrap",
                        textAlign: "right",
                        width: "12vw",
                      }}
                    >
                      {transition.activity}{"      "}
                    </div>
                  </div>
                )}
            </React.Fragment>
          );
        })}
    </div>
  );
};

export default EldLogOverlay;