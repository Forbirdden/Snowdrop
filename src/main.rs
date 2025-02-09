use std::{
    error::Error,
    io::{stdin, stdout, BufRead, Read, Write}, 
    net::TcpStream,
    sync::{Arc, RwLock}, 
    thread, 
    time::Duration
};

use colored::{Color, Colorize};
use crossterm::{
    cursor::MoveLeft, 
    event::{self, Event, KeyCode}, 
    terminal::{disable_raw_mode, enable_raw_mode}, 
    ExecutableCommand
};
use rand::random;
use regex::Regex;
use lazy_static::lazy_static;


const DEFAULT_HOST: &str = "meex.lol:11234";
const ADVERTISEMENT: &str = "\r\x1B[1A use bRAC client! https://github.com/MeexReay/bRAC \x1B[1B";

const MAX_MESSAGES: usize = 100;
const MAGIC_KEY: &str = "\u{B9AC}\u{3E70}";
const ADVERTISEMENT_ENABLED: bool = false;
const UPDATE_TIME: u64 = 50;


lazy_static! {
    static ref DATE_REGEX: Regex = Regex::new(r"\[(.*?)\] (.*)").unwrap();
    static ref COLORED_USERNAMES: Vec<(Regex, Color)> = vec![
        (Regex::new(&format!(r"{}<(.*?)> (.*)", MAGIC_KEY)).unwrap(), Color::Green),
        (Regex::new(r"\u{2550}\u{2550}\u{2550}<(.*?)> (.*)").unwrap(), Color::BrightRed),
        (Regex::new(r"(.*?): (.*)").unwrap(), Color::Magenta),
        (Regex::new(r"<(.*?)> (.*)").unwrap(), Color::Cyan),
    ];
}


fn send_message(host: &str, message: &str) -> Result<(), Box<dyn Error>> {
    let mut stream = TcpStream::connect(host)?;
    stream.write_all(&[0x01])?;
    let data = format!("\r\x07{}{}{}", 
        message,
        if message.chars().count() < 39 { 
            " ".repeat(39-message.chars().count()) 
        } else { 
            String::new()
        },
        if ADVERTISEMENT_ENABLED {ADVERTISEMENT} else {""}
    );
    stream.write_all(data.as_bytes())?;
    Ok(())
}

fn skip_null(stream: &mut TcpStream) -> Result<Vec<u8>, Box<dyn Error>> {
    loop {
        let mut buf = vec![0; 1];
        stream.read_exact(&mut buf)?;
        if buf[0] != 0 {
            break Ok(buf)
        }
    }
}

fn read_messages(host: &str) -> Result<String, Box<dyn Error>> {
    let mut stream = TcpStream::connect(host)?;

    stream.write_all(&[0x00])?;

    let packet_size = {
        let mut data = skip_null(&mut stream)?;
        
        loop {
            let mut buf = vec![0; 1];
            stream.read_exact(&mut buf)?;
            let ch = buf[0];
            if ch == 0 {
                break
            }
            data.push(ch);
        }

        String::from_utf8(data)?
            .trim_matches(char::from(0))
            .parse()?
    };

    stream.write_all(&[0x01])?;

    let packet_data = {
        let mut data = skip_null(&mut stream)?;
        while data.len() < packet_size {
            let mut buf = vec![0; packet_size - data.len()];
            let read_bytes = stream.read(&mut buf)?;
            buf.truncate(read_bytes);
            data.append(&mut buf);
        }
        String::from_utf8_lossy(&data).to_string()
    };

    Ok(packet_data)
}

fn recv_loop(host: &str, cache: Arc<RwLock<String>>, input: Arc<RwLock<String>>) -> Result<(), Box<dyn Error>> {
    while let Ok(data) = read_messages(host) {
        if data == cache.read().unwrap().clone() { 
            continue 
        }

        *cache.write().unwrap() = data;
        print_console(&cache.read().unwrap(), &input.read().unwrap())?;
        thread::sleep(Duration::from_millis(UPDATE_TIME));
    }
    Ok(())
}

fn get_input(prompt: &str, default: &str) -> String {
    let input = || -> Option<String> {
        let mut out = stdout().lock();
        out.write_all(prompt.as_bytes()).ok()?;
        out.flush().ok()?;
        stdin().lock().lines().next()
            .map(|o| o.ok())
            .flatten()
    }();

    if let Some(input) = &input {
        if input.is_empty() { 
            default 
        } else { 
            input
        }
    } else { 
        default 
    }.to_string()
}

fn sanitize_text(input: &str) -> String {
    let ansi_regex = Regex::new(r"\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])").unwrap();
    let control_chars_regex = Regex::new(r"[\x00-\x1F\x7F]").unwrap();
    let without_ansi = ansi_regex.replace_all(input, "");
    let cleaned_text = control_chars_regex.replace_all(&without_ansi, "");
    cleaned_text.into_owned()
}

/// nick content nick_color
fn find_username_color(message: &str) -> Option<(String, String, Color)> {
    for (re, color) in COLORED_USERNAMES.iter() {
        if let Some(captures) = re.captures(message) {
            return Some((captures[1].to_string(), captures[2].to_string(), color.clone()))
        }
    }
    None
}

fn format_message(message: String) -> Option<String> {
    let message = message.trim_end_matches(ADVERTISEMENT);
    let message = Regex::new(r"\{[^}]*\}\ ").unwrap().replace(&message, "").to_string();
    let message = sanitize_text(&message);
    if ADVERTISEMENT.len() > 0 && 
        message.starts_with(ADVERTISEMENT
        .trim_start_matches("\r")
        .trim_start_matches("\n")) {
        return None
    }

    let date = DATE_REGEX.captures(&message)?;
    let (date, message) = (date.get(1)?.as_str().to_string(), date.get(2)?.as_str().to_string());

    Some(if let Some(captures) = find_username_color(&message) {
        let nick = captures.0;
        let content = captures.1;
        let color = captures.2;

        format!(
            "{} {} {}",
            format!("[{}]", date).white().dimmed(),
            format!("<{}>", nick).color(color).bold(),
            content.white().blink()
        )
    } else {
        format!(
            "{} {}",
            format!("[{}]", date).white().dimmed(),
            message.white().blink()
        )
    })
}

fn on_command(host: &str, command: &str) -> Result<(), Box<dyn Error>> {
    let command = command.trim_start_matches("/");
    let (command, args) = command.split_once(" ").unwrap_or((&command, ""));
    let args = args.split(" ").collect::<Vec<&str>>();

    if command == "clear" {
        send_message(host, &format!("\r\x1B[1A{}", " ".repeat(64)).repeat(MAX_MESSAGES))?;
        // *input.write().unwrap() = "/ заспамлено)))".to_string();
    } else if command == "spam" {
        send_message(host, &format!("\r\x1B[1A{}{}", args.join(" "), " ".repeat(10)).repeat(MAX_MESSAGES))?;
        // *input.write().unwrap() = "/ заспамлено)))".to_string();
    }

    Ok(())
}

fn print_console(messages: &str, input: &str) -> Result<(), Box<dyn Error>> {
    let mut messages = messages.split("\n")
        .map(|o| o.to_string())
        .collect::<Vec<String>>();
    messages.reverse();
    messages.truncate(MAX_MESSAGES);
    messages.reverse();
    let messages: Vec<String> = messages.into_iter().filter_map(format_message).collect();
    let text = format!(
        "{}{}\n> {}", 
        "\n".repeat(MAX_MESSAGES - messages.len()), 
        messages.join("\n"), 
        // if sound { "\x07" } else { "" }, 
        input
    );
    for line in text.lines() {
        write!(stdout().lock(), "\r\n{}", line)?;
        stdout().lock().flush()?;
    }
    Ok(())
}

fn main() {
    let host = get_input(&format!("Host (default: {}) > ", DEFAULT_HOST), DEFAULT_HOST);
    let anon_name = format!("Anon#{:X}", random::<u16>());
    let name = get_input(&format!("Name (default: {}) > ", anon_name), &anon_name);

    let messages = Arc::new(RwLock::new(String::new()));
    let input = Arc::new(RwLock::new(String::new()));

    enable_raw_mode().unwrap();

    thread::spawn({
        let host = host.clone();
        let messages = messages.clone();
        let input = input.clone();

        move || {
            let _ = recv_loop(&host, messages, input);
            println!("Connection closed");
        }
    });

    thread::spawn({
        let messages = messages.clone();
        let input = input.clone();

        move || {
            print_console(
                &messages.read().unwrap(), 
                &input.read().unwrap()
            ).expect("Error printing console");
            thread::sleep(Duration::from_millis(UPDATE_TIME));
        }
    });

    loop {
        if !event::poll(Duration::from_millis(50)).unwrap_or(false) { continue }

        let event = match event::read() {
            Ok(i) => i,
            Err(_) => { continue },
        };

        match event {
            Event::Key(event) => {
                match event.code {
                    KeyCode::Enter => {
                        let message = input.read().unwrap().clone();
        
                        let input_len = input.read().unwrap().len();
                        stdout().lock().execute(MoveLeft(input_len as u16)).unwrap();
                        write!(stdout(), "{}{}", " ".repeat(input_len), MoveLeft(input_len as u16).to_string()).unwrap();
                        stdout().lock().flush().unwrap();
                        input.write().unwrap().clear();
        
                        if !message.is_empty() {
                            if message.starts_with("/") {
                                on_command(&host, &message).expect("Error on command");
                            } else {
                                send_message(&host, &format!("{}<{}> {}", MAGIC_KEY, name, message)).expect("Error sending message");
                            }
                        }
                    }
                    KeyCode::Backspace => {
                        if input.write().unwrap().pop().is_some() {
                            stdout().lock().execute(MoveLeft(1)).unwrap();
                            write!(stdout(), " {}", MoveLeft(1).to_string()).unwrap();
                            stdout().lock().flush().unwrap();
                        }
                    }
                    KeyCode::Char(c) => {
                        input.write().unwrap().push(c);
                        write!(stdout(), "{}", c).unwrap();
                        stdout().lock().flush().unwrap();
                    }
                    KeyCode::Esc => {
                        disable_raw_mode().unwrap();
                        break;
                    },
                    _ => {}
                }
            },
            Event::Paste(data) => {
                input.write().unwrap().push_str(&data);
                write!(stdout(), "{}", &data).unwrap();
                stdout().lock().flush().unwrap();
            }
            _ => {}
        }
    }
}
