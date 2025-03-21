use ratatui::{
    backend::CrosstermBackend,
    layout::{Constraint, Direction, Layout},
    style::{Color, Modifier, Style},
    widgets::{Block, Borders, Paragraph, Wrap},
    Terminal,
};
use crossterm::{
    event::{self, Event, KeyCode},
    execute,
    terminal::{disable_raw_mode, enable_raw_mode, EnterAlternateScreen, LeaveAlternateScreen},
};
use std::{io, sync::Arc, time::Duration};

pub struct TerminalUI {
    terminal: Terminal<CrosstermBackend<io::Stdout>>,
}

impl TerminalUI {
    pub fn new() -> Result<Self, Box<dyn std::error::Error>> {
        enable_raw_mode()?;
        let mut stdout = io::stdout();
        execute!(stdout, EnterAlternateScreen)?;
        let backend = CrosstermBackend::new(stdout);
        let terminal = Terminal::new(backend)?;
        Ok(Self { terminal })
    }

    pub fn draw(
        &mut self,
        servers: &[super::config::ServerConfig],
        messages: &[String],
        input: &str,
    ) -> Result<(), Box<dyn std::error::Error>> {
        self.terminal.draw(|f| {
            let chunks = Layout::default()
                .direction(Direction::Vertical)
                .margin(1)
                .constraints(
                    [
                        Constraint::Length(3),
                        Constraint::Min(10),
                        Constraint::Length(3),
                    ]
                    .as_ref(),
                )
                .split(f.size());

            // Server tabs
            let titles = servers
                .iter()
                .map(|s| format!(" {} ", s.alias))
                .collect::<Vec<_>>();
            let tabs = ratatui::widgets::Tabs::new(titles)
                .block(Block::default().borders(Borders::ALL))
                .highlight_style(Style::default().fg(Color::Yellow));
            f.render_widget(tabs, chunks[0]);

            // Messages
            let messages_block = Block::default()
                .title("Messages")
                .borders(Borders::ALL);
            let messages_text = messages.join("\n");
            let messages_paragraph = Paragraph::new(messages_text)
                .block(messages_block)
                .wrap(Wrap { trim: true });
            f.render_widget(messages_paragraph, chunks[1]);

            // Input
            let input_block = Block::default()
                .title("Input")
                .borders(Borders::ALL);
            let input_paragraph = Paragraph::new(input)
                .block(input_block)
                .style(Style::default().fg(Color::Green));
            f.render_widget(input_paragraph, chunks[2]);
        })?;
        Ok(())
    }
}

impl Drop for TerminalUI {
    fn drop(&mut self) {
        disable_raw_mode().unwrap();
        execute!(io::stdout(), LeaveAlternateScreen).unwrap();
    }
}
