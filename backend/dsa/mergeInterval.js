export default function mergeInterval(intervals, newInterval) {
    // fetched from mongoDb in sorted order so no need to explicitly sort the intervals
    if (intervals.length == 0)
        return true;

    let merged = [intervals[0]]

    for (let i = 1; i < intervals.length; i++) {
        if (intervals[i][0] <= merged[merged.length - 1][1])
            merged[merged.length - 1][1] = Math.max(intervals[i][1], merged[merged.length - 1][1])
        else
            merged.push(intervals[i])
    }

    // checking for clash in booking
    for (let i = 0; i < merged.length; i++) {
        if (
            (newInterval[0] >= merged[i][0] && newInterval[0] < merged[i][1]) || // New start overlaps
            (newInterval[1] > merged[i][0] && newInterval[1] <= merged[i][1]) || // New end overlaps
            (newInterval[0] <= merged[i][0] && newInterval[1] >= merged[i][1])   // New interval fully covers an existing one
        ) {
            return false; // Clash found, reject booking
        }

    }
    return true; // No clashes, booking is valid
}