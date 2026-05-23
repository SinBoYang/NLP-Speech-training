async function callAPI() {
    try {
        const response = await fetch('/api/hello');
        const data = await response.json();
        document.getElementById('result').textContent = `✓ ${data.message}`;
    } catch (error) {
        document.getElementById('result').textContent = `✗ 錯誤: ${error.message}`;
    }
}
