mod config;
mod proto;
mod ui;

use std::{sync::Arc, time::Duration};
use config::{AppConfig, CliArgs, ProtocolType};
use proto::{Protocol, irc::IrcProtocol};
use clap::Parser;
use tokio::sync::mpsc;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args = CliArgs::parse();
    let mut config = config::load_config(args.config)?;
    
    if args.add_server {
        add_server_interactively(&mut config).await?;
        config::save_config(&config, &config::default_config_path())?;
        return Ok(());
    }

    let mut ui = ui::TerminalUI::new()?;
    let (tx, mut rx) = mpsc::channel(100);
    
    // Запуск обработки сообщений
    tokio::spawn(async move {
        for server in &mut config.servers {
            let mut protocol: Box<dyn Protocol> = match server.protocol {
                ProtocolType::BRAC => Box::new(proto::brac::BracProtocol::new()),
                ProtocolType::IRC => Box::new(IrcProtocol::new()),
            };
            
            if let Err(e) = protocol.connect(&server.host, server.ssl).await {
                eprintln!("Connection error: {}", e);
                continue;
            }
            
            server.connection = Some(Arc::new(Mutex::new(protocol)));
        }
        
        loop {
            for server in &mut config.servers {
                if let Some(conn) = &server.connection {
                    let mut conn = conn.lock().await;
                    if let Ok(messages) = conn.read_messages().await {
                        for msg in messages {
                            tx.send(msg).await.unwrap();
                        }
                    }
                }
            }
            tokio::time::sleep(Duration::from_millis(config.update_interval)).await;
        }
    });
    
    // Основной цикл UI
    let mut messages = Vec::new();
    let mut input = String::new();
    
    loop {
        while let Ok(msg) = rx.try_recv() {
            messages.push(msg);
            if messages.len() > 100 {
                messages.remove(0);
            }
        }
        
        ui.draw(&config.servers, &messages, &input)?;
        
        if event::poll(Duration::from_millis(100))? {
            if let Event::Key(key) = event::read()? {
                match key.code {
                    KeyCode::Char(c) => input.push(c),
                    KeyCode::Backspace => { input.pop(); }
                    KeyCode::Enter => {
                        // Отправка сообщения
                        input.clear();
                    }
                    KeyCode::Esc => break,
                    _ => {}
                }
            }
        }
    }
    
    Ok(())
}

async fn add_server_interactively(config: &mut AppConfig) -> Result<(), Box<dyn std::error::Error>> {
    // Реализация интерактивного добавления сервера
    Ok(())
}