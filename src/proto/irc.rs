use super::Protocol;
use native_tls::{TlsConnector, TlsStream};
use std::{
    io::{Read, Write},
    net::TcpStream,
    sync::{Arc, Mutex},
};
use tokio::task::spawn_blocking;

pub struct IrcProtocol {
    stream: Option<Arc<Mutex<dyn Read + Write + Send>>>,
}

impl IrcProtocol {
    pub fn new() -> Self {
        Self { stream: None }
    }
}

#[async_trait::async_trait]
impl Protocol for IrcProtocol {
    async fn connect(&mut self, host: &str, ssl: bool) -> Result<(), Box<dyn std::error::Error>> {
        let host = host.to_string();
        let stream = spawn_blocking(move || {
            let tcp = TcpStream::connect(&host)?;
            if ssl {
                let connector = TlsConnector::builder().build()?;
                Ok(Arc::new(Mutex::new(connector.connect(&host, tcp)?)) as Result<_, Box<dyn std::error::Error>>
            } else {
                Ok(Arc::new(Mutex::new(tcp)) as _)
            }
        }).await??;
        
        self.stream = Some(stream);
        self.send_message("NICK bRAC_user").await?;
        self.send_message("USER bRAC * * :bRAC Client").await?;
        Ok(())
    }

    async fn send_message(&mut self, message: &str) -> Result<(), Box<dyn std::error::Error>> {
        let stream = self.stream.as_ref().ok_or("Not connected")?;
        let mut stream = stream.lock().unwrap();
        stream.write_all(format!("{}\r\n", message).as_bytes())?;
        Ok(())
    }

    async fn read_messages(&mut self) -> Result<Vec<String>, Box<dyn std::error::Error>> {
        let stream = self.stream.as_ref().ok_or("Not connected")?.clone();
        let mut buffer = [0; 4096];
        
        let data = spawn_blocking(move || {
            let mut stream = stream.lock().unwrap();
            let size = stream.read(&mut buffer)?;
            Ok::<_, Box<dyn std::error::Error>>(String::from_utf8_lossy(&buffer[..size]).to_string())
        }).await??;
        
        Ok(data.split("\r\n")
            .filter(|s| !s.is_empty())
            .map(|s| s.to_string())
            .collect())
    }
}