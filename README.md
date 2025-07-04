# Health Plan Comparison Tool

A modern, open-source web application for comparing health insurance plans based on your family's actual healthcare usage. Features intelligent PDF analysis of Summary of Benefits and Coverage (SBC) documents and automated plan discovery.

## 🌟 Features

### Core Functionality
- **PDF Analysis**: Upload SBC documents for automatic data extraction
- **Manual Plan Entry**: Comprehensive plan data input with validation
- **Cost Calculation**: Accurate projections with proper OOP max enforcement
- **Multi-Scenario Analysis**: Compare costs across low, medium, and high usage scenarios

### Advanced Features
- **Interactive Charts**: Visual comparison with Chart.js integration
- **Educational Content**: Built-in SBC guidance and healthcare cost education
- **Data Persistence**: Local storage with import/export capabilities
- **Regional Cost Adjustments**: Customizable service costs for different areas
- **Responsive Design**: Works on desktop, tablet, and mobile devices

### Family-Friendly
- **Flexible Family Size**: Support for any number of family members
- **Medication Tracking**: Detailed prescription cost analysis by tier
- **Service Usage**: Track visits, therapy, lab work, imaging, and more
- **Usage Scenarios**: Quick-set templates for different healthcare patterns

## 🚀 Getting Started

### Option 1: Simple Local Server
```bash
# Clone the repository
git clone https://github.com/rachedblili/HealthPlanCompare.git
cd HealthPlanCompare

# Start a local server
python -m http.server 8000

# Open in your browser
open http://localhost:8000/public/
```

### Option 2: Node.js Development
```bash
# Install Node.js dependencies (optional)
npm install

# Start development server
npm run dev
```

### Option 3: Static Hosting
Deploy the entire folder to any static hosting service:
- GitHub Pages
- Netlify
- Vercel
- AWS S3 + CloudFront

## 📖 How to Use

### 1. Add Your Health Plans
- **Upload PDFs**: Drag and drop SBC documents for automatic analysis
- **Manual Entry**: Input plan details manually with comprehensive form validation
- **Plan Templates**: Use built-in examples to get started quickly

### 2. Configure Your Family
- Add unlimited family members and set their healthcare usage patterns
- Include medications with proper tier classifications and monthly costs
- Use quick-set usage scenarios (low/medium/high) or customize individually

### 3. Adjust Service Costs
- Customize healthcare service costs for your geographic region
- Choose from low/medium/high cost-of-living areas
- Fine-tune individual service pricing as needed

### 4. Compare and Analyze
- View summary comparisons with clear cost breakdowns
- Explore detailed family member analysis
- Understand how individual and family OOP maximums affect costs
- Generate visual charts and export detailed reports

### 5. Export and Share
- Export results as CSV, PDF, or JSON
- Export detailed calculation worksheets for analysis
- Save and load configurations using browser storage
- Import/export family and plan data for backup

## 🏗️ Architecture

### Technology Stack
- **Frontend**: Vanilla JavaScript (ES6 modules)
- **Styling**: Tailwind CSS
- **Charts**: Chart.js
- **PDF Processing**: PDF.js
- **Storage**: Browser localStorage

### Project Structure
```
/
├── public/
│   └── index.html          # Main application entry
├── src/
│   ├── components/         # UI components
│   │   ├── App.js         # Main application
│   │   ├── PlanManager.js # Plan input and management
│   │   ├── FamilyManager.js # Family usage configuration
│   │   ├── ServiceCostManager.js # Service cost assumptions
│   │   ├── ResultsManager.js # Results display
│   │   ├── ChartManager.js # Data visualization
│   │   ├── SBCEducationModal.js # Educational content
│   │   ├── WarningBanner.js # User guidance
│   │   └── DisclaimerModal.js # Legal disclaimers
│   └── utils/             # Utility modules
│       ├── CostCalculator.js # 3-phase calculation engine
│       ├── PDFAnalyzer.js   # SBC document parsing
│       ├── DataManager.js   # Import/export handling
│       ├── StorageManager.js # Local data persistence
│       └── EventEmitter.js  # Component communication
├── assets/
│   ├── css/               # Stylesheets
│   └── js/                # Main entry point
└── data/                  # Sample data and configurations
```

## 🔧 Configuration

### Service Cost Assumptions
The tool uses average healthcare costs that can be customized by region:

**Low Cost Areas**: 
- Primary care: $120, Specialist: $180, Therapy: $110

**Medium Cost Areas** (default):
- Primary care: $150, Specialist: $200, Therapy: $130

**High Cost Areas**:
- Primary care: $200, Specialist: $350, Therapy: $180

All costs include lab work ($100-140), imaging ($250-400), and physical therapy ($90-130) based on regional variations.

### Medication Tiers
- **Tier 1**: Generic medications
- **Tier 2**: Preferred brand medications  
- **Tier 3**: Non-preferred brand medications
- **Tier 4**: Specialty medications

## 🤝 Contributing

We welcome contributions! Here's how to get started:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Test thoroughly
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

### Development Guidelines
- Use ES6 modules and modern JavaScript
- Follow existing code style and patterns
- Add comments for complex logic
- Test across different browsers
- Ensure mobile responsiveness

## 📊 Accuracy & Limitations

### What This Tool Does Well
- Accurate cost calculations based on plan structures
- Comprehensive family usage modeling
- Multiple scenario analysis
- Visual comparison of options

### Important Limitations
- **Network Coverage**: Tool cannot verify provider networks
- **Formulary Check**: Medication coverage should be verified separately  
- **Plan Changes**: Insurance plans change annually
- **Regional Variation**: Costs may vary by geographic location

### Disclaimer
This tool provides estimates for comparison purposes. Always verify details with insurance providers and consult healthcare professionals for medical decisions.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: Check this README and inline help
- **Issues**: Report bugs on [GitHub Issues](https://github.com/rachedblili/HealthPlanCompare/issues)
- **Discussions**: Join conversations on [GitHub Discussions](https://github.com/rachedblili/HealthPlanCompare/discussions)

## 🙏 Acknowledgments

- Built with modern web technologies for maximum accessibility
- Inspired by the need for transparent healthcare cost comparison
- Thanks to all contributors and the open-source community

---

**Made with ❤️ for better healthcare decisions**