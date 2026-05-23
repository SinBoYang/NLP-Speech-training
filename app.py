from flask import Flask, render_template

app = Flask(__name__)

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/api/hello')
def hello():
    return {'message': 'Hello from Flask!'}

if __name__ == '__main__':
    app.run(debug=True, port=5000)
