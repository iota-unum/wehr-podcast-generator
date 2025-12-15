import React, { useMemo } from 'react';

interface TimelineEvent {
    date: string;
    event: string;
    nodeId: string;
}

interface TimelineData {
    events: TimelineEvent[];
}

interface TimelineViewerProps {
    timelineJson: string;
}

export const TimelineViewer: React.FC<TimelineViewerProps> = ({ timelineJson }) => {
    const processedEvents = useMemo(() => {
        try {
            const data: TimelineData = JSON.parse(timelineJson);
            if (!data || !Array.isArray(data.events)) {
                return [];
            }
            // De-duplicate based on date and event, keeping the first occurrence
            const uniqueEvents = new Map<string, TimelineEvent>();
            for (const event of data.events) {
                // Normalize keys for better matching
                const key = `${event.date.trim().toLowerCase()}-${event.event.trim().toLowerCase()}`;
                if (!uniqueEvents.has(key)) {
                    uniqueEvents.set(key, event);
                }
            }
            return Array.from(uniqueEvents.values());
        } catch (e) {
            console.error("Failed to parse timeline JSON:", e);
            return [];
        }
    }, [timelineJson]);

    if (processedEvents.length === 0) {
        return (
            <div className="w-full h-96 flex items-center justify-center bg-gray-900 border-2 border-gray-700 rounded-lg">
                <p className="text-gray-500">No timeline events were generated for this content.</p>
            </div>
        );
    }

    return (
        <div className="w-full h-96 overflow-y-auto p-6 bg-gray-900 border-2 border-gray-700 rounded-lg relative">
            <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-gray-700 ml-[-1px]"></div>
            {processedEvents.map((item, index) => (
                <div key={`${item.nodeId}-${index}`} className="relative flex items-center justify-center my-8">
                    {/* Dot on the timeline */}
                    <div className="absolute left-1/2 -translate-x-1/2 w-4 h-4 bg-purple-500 rounded-full border-4 border-gray-900 z-10"></div>

                    {index % 2 === 0 ? (
                        <div className="w-full flex justify-start items-center">
                            <div className="w-1/2 pr-8 text-right">
                                <p className="font-bold text-lg text-purple-300">{item.date}</p>
                            </div>
                            <div className="w-1/2 pl-8">
                                <div className="bg-gray-800 p-3 rounded-lg shadow-md border border-gray-700">
                                    <p className="text-gray-300">{item.event}</p>
                                </div>
                            </div>
                        </div>
                    ) : (
                         <div className="w-full flex justify-end items-center">
                            <div className="w-1/2 pr-8">
                                <div className="bg-gray-800 p-3 rounded-lg shadow-md border border-gray-700">
                                    <p className="text-gray-300 text-right">{item.event}</p>
                                </div>
                            </div>
                            <div className="w-1/2 pl-8 text-left">
                               <p className="font-bold text-lg text-purple-300">{item.date}</p>
                            </div>
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
};
