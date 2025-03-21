use std::{cmp::{max, min}, error::Error, io::{stdout, Write}, sync::{atomic::{AtomicUsize, Ordering}, Arc, RwLock}, thread, time::{Duration, SystemTime, UNIX_EPOCH}};

use colored::{Color, Colorize};
use crossterm::{cursor::{MoveLeft, MoveRight}, event::{self, Event, KeyCode, KeyModifiers, MouseEventKind}, execute, terminal::{self, disable_raw_mode, enable_raw_mode}};

use crate::{proto::{connect, send_message_auth}, util::{char_index_to_byte_index, string_chunks}, IP_REGEX};

use super::{proto::read_messages, util::sanitize_text, COLORED_USERNAMES, DATE_REGEX, config::Context, proto::send_message};


pub struct ChatStorage {
    messages: RwLock<Vec<String>>,
    packet_size: AtomicUsize
}

impl ChatStorage {
    pub fn new() -> Self {
        ChatStorage {
            messages: RwLock::new(Vec::new()),
            packet_size: AtomicUsize::default()
        }
    }

    pub fn packet_size(&self) -> usize {
        self.packet_size.load(Ordering::SeqCst)
    }

    pub fn messages(&self) -> Vec<String> {
        self.messages.read().unwrap().clone()
    }

    pub fn update(&self, messages: Vec<String>, packet_size: usize) {
        self.packet_size.store(packet_size, Ordering::SeqCst);
        *self.messages.write().unwrap() = messages;
    }

    pub fn append(&self, messages: Vec<String>, packet_size: usize) {
        self.packet_size.store(packet_size, Ordering::SeqCst);
        self.messages.write().unwrap().append(&mut messages.clone());
    }
}


const HELP_MESSAGE: &str = "Help message:\r
/help - show help message\r
/clear n - send empty message n times\r
/spam n text - send message with text n times\r
/ping - check server ping\r
\r
Press enter to close";


fn on_command(ctx: Arc<Context>, command: &str) -> Result<(), Box<dyn Error>> {
    let command = command.trim_start_matches("/");
    let (command, args) = command.split_once(" ").unwrap_or((&command, ""));
    let args = args.split(" ").collect::<Vec<&str>>();

    let response = move || -> Option<String> { 
        if command == "clear" {
            let times = args.get(0)?.parse().ok()?;
            for _ in 0..times {
                send_message(&mut connect(&ctx.host, ctx.enable_ssl).ok()?, "\r").ok()?;
            }
            None
        } else if command == "spam" {
            let times = args.get(0)?.parse().ok()?;
            let msg = args[1..].join(" ");
            for _ in 0..times {
                send_message(&mut connect(&ctx.host, ctx.enable_ssl).ok()?, &("\r".to_string()+&msg)).ok()?;
            }
            None
            // send_message(&mut connect(&ctx.host, ctx.enable_ssl)?, 
            //     &prepare_message(ctx.clone(), 
            //         &format!("\r\x1B[1A{}{}", args.join(" "), " ".repeat(10)).repeat(ctx.max_messages)
            //         ))?;
        } else if command == "help" {
            Some(HELP_MESSAGE.to_string())
        } else if command == "ping" {
            let mut before = ctx.messages.packet_size();
            let message = format!("Checking ping... {:X}", SystemTime::now().duration_since(UNIX_EPOCH).ok()?.as_millis());

            send_message(&mut connect(&ctx.host, ctx.enable_ssl).ok()?, &message).ok()?;

            let start = SystemTime::now();

            loop {
                let data = read_messages(
                    &mut connect(&ctx.host, ctx.enable_ssl).ok()?, 
                    ctx.max_messages, 
                    before, 
                    !ctx.enable_ssl,
                    ctx.enable_chunked
                ).ok().flatten();
    
                if let Some((data, size)) = data {
                    if let Some(last) = data.iter().rev().find(|o| o.contains(&message)) {
                        if last.contains(&message) {
                            break;
                        } else {
                            before = size;
                        }
                    } else {
                        before = size;
                    }
                }
            }

            send_message(&mut connect(&ctx.host, ctx.enable_ssl).ok()?, &format!("Ping = {}ms", start.elapsed().unwrap().as_millis())).ok()?;

            None
        } else {
            None
        }
    }();

    if let Some(response) = response {
        write!(stdout(), "{}", response)?;
        stdout().flush()?;
    }

    Ok(())
}


pub fn print_console(ctx: Arc<Context>, messages: Vec<String>, input: &str) -> Result<(), Box<dyn Error>> {
    let (width, height) = terminal::size()?;
    let (width, height) = (width as usize, height as usize);

    let mut messages = messages
        .into_iter()
        .flat_map(|o| string_chunks(&o, width as usize - 1))
        .map(|o| (o.0.white().blink().to_string(), o.1))
        .collect::<Vec<(String, usize)>>();

    let messages_size = if messages.len() >= height {
        messages.len()-height
    } else {
        for _ in 0..height-messages.len() {
            messages.insert(0, (String::new(), 0));
        }
        0
    };

    let scroll = min(ctx.scroll.load(Ordering::SeqCst), messages_size);
    let scroll_f = ((1f64 - scroll as f64 / (messages_size+1) as f64) * (height-2) as f64).round() as usize+1;

    let messages = if height < messages.len() {
        if scroll < messages.len() - height {
            messages[
                messages.len()-height-scroll..
                messages.len()-scroll
            ].to_vec()
        } else {
            if scroll < messages.len() {
                messages[
                    0..
                    messages.len()-scroll
                ].to_vec()
            } else {
                vec![]
            }
        }
    } else {
        messages
    };

    let formatted_messages = if ctx.disable_formatting {
        messages
            .into_iter()
            .map(|(i, _)| i)
            .collect::<Vec<String>>()
    } else {
        messages
            .into_iter()
            .enumerate()
            .map(|(i, (s, l))| {
                format!("{}{}{}", 
                    s, 
                    " ".repeat(width - 1 - l), 
                    if i == scroll_f {
                        "▐".bright_yellow()
                    } else {
                        "▕".yellow()
                    }
                )
            })
            .collect::<Vec<String>>()
            
    };

    let text = format!(
        "{}\r\n{} {}", 
        formatted_messages.join("\r\n"),
        ">".bright_yellow(),
        input
    );

    let mut out = stdout().lock();
    write!(out, "{}", text)?;
    out.flush()?;

    Ok(())
}


fn prepare_message(context: Arc<Context>, message: &str) -> String {
    format!("{}{}{}",
        if !context.disable_hiding_ip {
            "\r\x07"
        } else {
            ""
        },
        message,
        if !context.disable_hiding_ip { 
            let spaces = if context.enable_auth {
                39
            } else {
                54
            };

            if message.chars().count() < spaces { 
                " ".repeat(spaces-message.chars().count()) 
            } else { 
                String::new()
            }
        } else {
            String::new()
        }
    )
}


fn format_message(ctx: Arc<Context>, message: String) -> Option<String> {
    let message = sanitize_text(&message);

    let date = DATE_REGEX.captures(&message)?;
    let (date, message) = (
        date.get(1)?.as_str().to_string(), 
        date.get(2)?.as_str().to_string(), 
    );

    let (ip, message) = if let Some(message) = IP_REGEX.captures(&message) {
        (Some(message.get(1)?.as_str().to_string()), message.get(2)?.as_str().to_string())
    } else {
        (None, message)
    };

    let message = message
        .trim_start_matches("(UNREGISTERED)")
        .trim_start_matches("(UNAUTHORIZED)")
        .trim_start_matches("(UNAUTHENTICATED)")
        .trim()
        .to_string()+" ";

    let prefix = if ctx.enable_ip_viewing {
        if let Some(ip) = ip {
            format!("{}{} [{}]", ip, " ".repeat(if 15 >= ip.chars().count() {15-ip.chars().count()} else {0}), date)
        } else {
            format!("{} [{}]", " ".repeat(15), date)
        }
    } else {
        format!("[{}]", date)
    };

    Some(if let Some(captures) = find_username_color(&message) {
        let nick = captures.0;
        let content = captures.1;
        let color = captures.2;

            format!(
            "{} {} {}",
            prefix.white().dimmed(),
            format!("<{}>", nick).color(color).bold(),
            content.white().blink()
        )
    } else {
        format!(
            "{} {}",
            prefix.white().dimmed(),
            message.white().blink()
        )
    })
}


fn find_username_color(message: &str) -> Option<(String, String, Color)> {
    for (re, color) in COLORED_USERNAMES.iter() {
        if let Some(captures) = re.captures(message) {
            return Some((captures[1].to_string(), captures[2].to_string(), color.clone()))
        }
    }
    None
}


fn replace_input(cursor: usize, len: usize, text: &str) {
    let spaces = if text.chars().count() < len {
        len-text.chars().count()
    } else {
        0
    };
    write!(stdout(), 
        "{}{}{}{}", 
        MoveLeft(1).to_string().repeat(cursor), 
        text,
        " ".repeat(spaces), 
        MoveLeft(1).to_string().repeat(spaces)
    ).unwrap();
    stdout().lock().flush().unwrap();
}

fn replace_input_left(cursor: usize, len: usize, text: &str, left: usize) {
    let spaces = if text.chars().count() < len {
        len-text.chars().count()
    } else {
        0
    };
    write!(stdout(), 
        "{}{}{}{}", 
        MoveLeft(1).to_string().repeat(cursor), 
        text,
        " ".repeat(spaces), 
        MoveLeft(1).to_string().repeat(len-left)
    ).unwrap();
    stdout().lock().flush().unwrap();
}


fn poll_events(ctx: Arc<Context>) -> Result<(), Box<dyn Error>> {
    let mut history: Vec<String> = vec![String::new()];
    let mut history_cursor: usize = 0;
    let mut cursor: usize = 0;

    let input = ctx.input.clone();
    let messages = ctx.messages.clone();

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
        
                        if !message.is_empty() {
                            replace_input(cursor, message.chars().count(), "");
                            input.write().unwrap().clear();

                            cursor = 0;

                            history.push(String::new());
                            history_cursor = history.len()-1;

                            if message.starts_with("/") && !ctx.disable_commands {
                                on_command(ctx.clone(), &message)?;
                            } else {
                                let message = prepare_message(
                                ctx.clone(), 
                                &ctx.message_format
                                    .replace("{name}", &ctx.name)
                                    .replace("{text}", &message)
                                );

                                if ctx.enable_auth {
                                    send_message_auth(&mut connect(&ctx.host, ctx.enable_ssl)?, &message)?;
                                } else {
                                    send_message(&mut connect(&ctx.host, ctx.enable_ssl)?, &message)?;
                                }
                            }
                        } else {
                            print_console(
                                ctx.clone(),
                                messages.messages(), 
                                ""
                            )?;
                        }
                    }
                    KeyCode::Backspace => {
                        if cursor == 0 || !(0..=history[history_cursor].len()).contains(&(cursor)) {
                            continue 
                        }
                        let len = input.read().unwrap().chars().count();
                        let i = char_index_to_byte_index(&history[history_cursor], cursor-1);
                        history[history_cursor].remove(i);
                        *input.write().unwrap() = history[history_cursor].clone();
                        replace_input_left(cursor, len, &history[history_cursor], cursor-1);
                        cursor -= 1;
                    }
                    KeyCode::Delete => {
                        if cursor == 0 || !(0..history[history_cursor].len()).contains(&(cursor)) {
                            continue 
                        }
                        let len = input.read().unwrap().chars().count();
                        let i = char_index_to_byte_index(&history[history_cursor], cursor);
                        history[history_cursor].remove(i);
                        *input.write().unwrap() = history[history_cursor].clone();
                        replace_input_left(cursor, len, &history[history_cursor], cursor);
                    }
                    KeyCode::Esc => {
                        on_close();
                        break;
                    }
                    KeyCode::Up | KeyCode::Down => {
                        history_cursor = if event.code == KeyCode::Up {
                            max(history_cursor, 1) - 1
                        } else {
                            min(history_cursor + 1, history.len() - 1)
                        };
                        let len = input.read().unwrap().chars().count();
                        *input.write().unwrap() = history[history_cursor].clone();
                        replace_input(cursor, len, &history[history_cursor]);
                        cursor = history[history_cursor].chars().count();
                    }
                    KeyCode::PageUp => {
                        let height = terminal::size().unwrap().1 as usize;
                        ctx.scroll.store(min(ctx.scroll.load(Ordering::SeqCst)+height, ctx.messages.messages().len()), Ordering::SeqCst);
                        print_console(
                            ctx.clone(),
                            messages.messages(), 
                            &input.read().unwrap()
                        )?;
                    }
                    KeyCode::PageDown => {
                        let height = terminal::size().unwrap().1 as usize;
                        ctx.scroll.store(max(ctx.scroll.load(Ordering::SeqCst), height)-height, Ordering::SeqCst);
                        print_console(
                            ctx.clone(),
                            messages.messages(), 
                            &input.read().unwrap()
                        )?;
                    }
                    KeyCode::Left => {
                        if cursor > 0 {
                            cursor -= 1;
                            write!(stdout(), "{}", MoveLeft(1).to_string(), ).unwrap();
                            stdout().lock().flush().unwrap();
                        }
                    }
                    KeyCode::Right => {
                        if cursor < history[history_cursor].len() {
                            cursor += 1;
                            write!(stdout(), "{}", MoveRight(1).to_string(), ).unwrap();
                            stdout().lock().flush().unwrap();
                        }
                    }
                    KeyCode::Char(c) => {
                        if event.modifiers.contains(KeyModifiers::CONTROL) && "zxcZXCячсЯЧС".contains(c) {
                            on_close();
                            break;
                        }
                        let i = char_index_to_byte_index(&history[history_cursor], cursor);
                        history[history_cursor].insert(i, c);
                        input.write().unwrap().insert(i, c);
                        write!(stdout(), "{}{}", 
                            history[history_cursor][i..].to_string(), 
                            MoveLeft(1).to_string().repeat(history[history_cursor].chars().count()-cursor-1)
                        ).unwrap();
                        stdout().lock().flush().unwrap();
                        cursor += 1;
                    }
                    _ => {}
                }
            },
            Event::Paste(data) => {
                let i = char_index_to_byte_index(&history[history_cursor], cursor);
                history[history_cursor].insert_str(i, &data);
                input.write().unwrap().insert_str(i, &data);
                write!(stdout(), "{}{}", 
                    history[history_cursor][cursor..].to_string(), 
                    MoveLeft(1).to_string().repeat(history[history_cursor].len()-cursor-1)
                ).unwrap();
                stdout().lock().flush().unwrap();
                cursor += data.len();
            },
            Event::Resize(_, _) => {
                print_console(
                    ctx.clone(),
                    messages.messages(), 
                    &input.read().unwrap()
                )?;
            },
            Event::Mouse(data) => {
                match data.kind {
                    MouseEventKind::ScrollUp => {
                        ctx.scroll.store(min(ctx.scroll.load(Ordering::SeqCst)+3, ctx.messages.messages().len()), Ordering::SeqCst);
                        print_console(
                            ctx.clone(),
                            messages.messages(), 
                            &input.read().unwrap()
                        )?;
                    },
                    MouseEventKind::ScrollDown => {
                        ctx.scroll.store(max(ctx.scroll.load(Ordering::SeqCst), 3)-3, Ordering::SeqCst);
                        print_console(
                            ctx.clone(),
                            messages.messages(), 
                            &input.read().unwrap()
                        )?;
                    },
                    _ => {}
                }
            }
            _ => {}
        }
    }

    Ok(())
}

pub fn recv_tick(ctx: Arc<Context>) -> Result<(), Box<dyn Error>> {
    match read_messages(
        &mut connect(&ctx.host, ctx.enable_ssl)?, 
        ctx.max_messages, 
        ctx.messages.packet_size(), 
        !ctx.enable_ssl,
        ctx.enable_chunked
    ) {
        Ok(Some((messages, size))) => {
            let messages: Vec<String> = if ctx.disable_formatting {
                messages 
            } else {
                messages.into_iter().flat_map(|o| format_message(ctx.clone(), o)).collect()
            };

            if ctx.enable_chunked {
                ctx.messages.append(messages.clone(), size);
                print_console(ctx.clone(), ctx.messages.messages(), &ctx.input.read().unwrap())?;
            } else {
                ctx.messages.update(messages.clone(), size);
                print_console(ctx.clone(), messages, &ctx.input.read().unwrap())?;
            }
        }
        Err(e) => {
            println!("{:?}", e);
        }
        _ => {}
    }
    thread::sleep(Duration::from_millis(ctx.update_time as u64));
    Ok(())
}

pub fn on_close() {
    disable_raw_mode().unwrap();
    execute!(stdout(), event::DisableMouseCapture).unwrap();
}

pub fn run_main_loop(ctx: Arc<Context>) {
    enable_raw_mode().unwrap();
    execute!(stdout(), event::EnableMouseCapture).unwrap();

    thread::spawn({
        let ctx = ctx.clone();

        move || {
            loop { 
                recv_tick(ctx.clone()).expect("Error printing console");
            }
        }
    });

    poll_events(ctx).expect("Error while polling events");
}