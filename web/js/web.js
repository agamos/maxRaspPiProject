var socket = io();

function cancelAlarm() {
        socket.emit('cancelAlarm');
}
function invokeAlarm() {
        socket.emit('invokeAlarm');
}
